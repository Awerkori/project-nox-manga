<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    AlertTriangle,
    Eye,
    Compass,
    ArrowRight
  } from '@lucide/svelte';
  import type { Work } from '$lib/types';
  import { kindLabels } from '$lib/types';
  import { page } from '$app/state';
  import { resolveCoverUrl, resolveOriginalCoverUrl } from '$lib/covers';
  import { decodeHtmlEntities } from '$lib/html-entities';

  type Props = {
    works: Work[];
    continueReading?: Array<{
      workId: string;
      chapterId: string;
      destinationUrl: string;
    }>;
  };

  let { works = [], continueReading = [] }: Props = $props();

  // Exactly 10 works for the editorial book
  let displayWorks = $derived(works.slice(0, 10));

  // Active state
  let currentIndex = $state(0);
  let isPaused = $state(false);
  let isFlipping = $state(false);
  let prefersReducedMotion = $state(false);

  // Timing configuration
  const READING_TIME_MS = 3500; // 3.5s per work showcase
  const FLIP_DURATION_MS = 750; // 750ms authentic page curl transition

  let timerStartTime = 0;
  let remainingTime = READING_TIME_MS;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  // StPageFlip instance & DOM references
  let bookEl: HTMLDivElement | null = $state(null);
  let pageFlipInstance: any = null;

  // Derived active works for mobile & SSR fallback
  let currentWork = $derived(
    displayWorks.length > 0 ? displayWorks[currentIndex % displayWorks.length] : null
  );

  // Helpers
  function fallbackCover(node: HTMLImageElement) {
    const onError = () => {
      if (node.src.includes('size=thumb') || node.src.includes('size=hero')) {
        node.src = resolveOriginalCoverUrl(node.src);
      } else if (!node.src.endsWith('/brand/nox-symbol.webp')) {
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

  function formatViews(n?: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  function getCover(w: Work | null, size: 'hero' | 'thumb' = 'hero'): string {
    if (!w) return '';
    return resolveCoverUrl(w.cover_id || (w as any).coverId, w.slug, w.id, { size });
  }

  function getIsAdult(w: Work | null): boolean {
    if (!w) return false;
    return Boolean((w.content_rating || (w as any).contentRating) === 'ADULT_18');
  }

  function getContinueItem(w: Work | null) {
    if (!w) return null;
    return continueReading.find(
      (c: { workId: string; destinationUrl: string }) => c.workId === w.id
    );
  }

  // Timer Controls
  function startReadingTimer(duration = READING_TIME_MS) {
    clearReadingTimer();
    if (displayWorks.length <= 1 || isPaused) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    timerStartTime = Date.now();
    remainingTime = duration;

    timerId = setTimeout(() => {
      if (!isPaused && !isFlipping) {
        flipPage('forward');
      }
    }, duration);
  }

  function clearReadingTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function pauseReadingTimer() {
    if (isPaused) return;
    isPaused = true;
    if (timerId !== null) {
      const elapsed = Date.now() - timerStartTime;
      remainingTime = Math.max(400, remainingTime - elapsed);
      clearReadingTimer();
    }
  }

  function resumeReadingTimer() {
    if (!isPaused) return;
    isPaused = false;
    if (!isFlipping) {
      startReadingTimer(remainingTime);
    }
  }

  // Page Flip Execution
  function flipPage(direction: 'forward' | 'backward') {
    if (isFlipping || displayWorks.length <= 1) return;
    clearReadingTimer();

    const totalWorks = displayWorks.length;
    let nextWorkIndex = 0;
    if (direction === 'forward') {
      nextWorkIndex = (currentIndex + 1) % totalWorks;
    } else {
      nextWorkIndex = (currentIndex - 1 + totalWorks) % totalWorks;
    }

    // Trigger subtle cosmic shimmer in background
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nox:book-flip', {
          detail: { direction, fromIndex: currentIndex, toIndex: nextWorkIndex }
        })
      );
    }

    if (pageFlipInstance && window.innerWidth >= 768) {
      try {
        isFlipping = true;
        if (direction === 'forward') {
          if (currentIndex === totalWorks - 1) {
            // Loop back to page 0
            pageFlipInstance.flip(0, 'bottom');
          } else {
            pageFlipInstance.flipNext('bottom');
          }
        } else {
          if (currentIndex === 0) {
            // Loop back to last spread
            pageFlipInstance.flip((totalWorks - 1) * 2, 'bottom');
          } else {
            pageFlipInstance.flipPrev('bottom');
          }
        }
      } catch (err) {
        // Fallback state update
        currentIndex = nextWorkIndex;
        isFlipping = false;
      }
    } else {
      // Mobile or reduced motion fallback
      currentIndex = nextWorkIndex;
    }

    if (!isPaused) {
      startReadingTimer(READING_TIME_MS);
    }
  }

  function goToWork(workIdx: number) {
    if (isFlipping || workIdx === currentIndex || workIdx < 0 || workIdx >= displayWorks.length) return;
    clearReadingTimer();

    if (pageFlipInstance && window.innerWidth >= 768) {
      try {
        isFlipping = true;
        const targetPage = workIdx * 2;
        pageFlipInstance.flip(targetPage, 'bottom');
      } catch (err) {
        currentIndex = workIdx;
        isFlipping = false;
      }
    } else {
      currentIndex = workIdx;
    }

    if (!isPaused) {
      startReadingTimer(READING_TIME_MS);
    }
  }

  // Keyboard Navigation
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      flipPage('forward');
    } else if (e.key === 'ArrowLeft') {
      flipPage('backward');
    }
  }

  // Touch Swipe on Mobile
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;
  let touchDeltaY = 0;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDeltaX = 0;
    touchDeltaY = 0;
    pauseReadingTimer();
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    touchDeltaX = e.touches[0].clientX - touchStartX;
    touchDeltaY = e.touches[0].clientY - touchStartY;
  }

  function handleTouchEnd() {
    const isHorizontalSwipe =
      Math.abs(touchDeltaX) > 40 && Math.abs(touchDeltaX) > Math.abs(touchDeltaY) * 1.25;

    if (isHorizontalSwipe) {
      if (touchDeltaX < 0) {
        flipPage('forward');
      } else {
        flipPage('backward');
      }
    }
    resumeReadingTimer();
  }

  function handleVisibilityChange() {
    if (typeof document !== 'undefined' && document.hidden) {
      clearReadingTimer();
    } else if (!isPaused && !isFlipping) {
      startReadingTimer(remainingTime);
    }
  }

  // Client lifecycle & StPageFlip initialization
  async function initStPageFlip() {
    if (typeof window === 'undefined' || !bookEl) return;
    if (window.innerWidth < 768) return; // StPageFlip active on tablet/desktop

    try {
      const pageFlipMod = await import('page-flip');
      const PageFlip =
        (pageFlipMod as any).PageFlip ||
        ((pageFlipMod as any).default && (pageFlipMod as any).default.PageFlip) ||
        (pageFlipMod as any).default;

      if (!PageFlip) return;

      if (pageFlipInstance) {
        try {
          pageFlipInstance.destroy();
        } catch (e) {}
        pageFlipInstance = null;
      }

      // Sized to stretch within 1376px container matching .home-content
      const pf = new PageFlip(bookEl, {
        width: 670,
        height: 560,
        size: 'stretch',
        minWidth: 380,
        maxWidth: 688,
        minHeight: 460,
        maxHeight: 580,
        showCover: false,
        drawShadow: true,
        maxShadowOpacity: 0.85,
        flippingTime: FLIP_DURATION_MS,
        usePortrait: false,
        startPage: currentIndex * 2,
        autoSize: true,
        disableFlipByClick: true,
        clickEventForward: true
      });

      const pageElements = bookEl.querySelectorAll<HTMLElement>('.nox-stf-page');
      if (pageElements.length > 0) {
        pf.loadFromHTML(pageElements);

        pf.on('flip', (e: { data: number }) => {
          const newWorkIndex = Math.floor(e.data / 2);
          currentIndex = newWorkIndex;
          isFlipping = false;
        });

        pf.on('changeState', (e: { data: string }) => {
          if (e.data === 'read') {
            isFlipping = false;
          } else if (e.data === 'flipping' || e.data === 'user_fold') {
            isFlipping = true;
          }
        });

        pageFlipInstance = pf;
      }
    } catch (err) {
      console.warn('StPageFlip init error:', err);
    }
  }

  function handleResize() {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 768 && !pageFlipInstance) {
      initStPageFlip();
    } else if (pageFlipInstance && window.innerWidth >= 768) {
      pageFlipInstance.update();
    }
  }

  onMount(() => {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', handleResize);

    initStPageFlip();
    startReadingTimer(READING_TIME_MS);
  });

  onDestroy(() => {
    clearReadingTimer();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
    if (pageFlipInstance) {
      try {
        pageFlipInstance.destroy();
      } catch (e) {}
      pageFlipInstance = null;
    }
  });

  function bindBookSection(node: HTMLElement) {
    node.addEventListener('mouseenter', pauseReadingTimer);
    node.addEventListener('mouseleave', resumeReadingTimer);

    return {
      destroy() {
        node.removeEventListener('mouseenter', pauseReadingTimer);
        node.removeEventListener('mouseleave', resumeReadingTimer);
      }
    };
  }

  function bindMobileTouch(node: HTMLElement) {
    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: true });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });

    return {
      destroy() {
        node.removeEventListener('touchstart', handleTouchStart);
        node.removeEventListener('touchmove', handleTouchMove);
        node.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<section
  class="nox-book-section"
  aria-label="Nox Book — Vitrine Editorial Interativa"
  use:bindBookSection
>
  <!-- Ambient Cosmic Aura behind Book -->
  <div class="book-ambient-glow" aria-hidden="true"></div>

  <!-- Outer Navigation Arrows (Desktop) -->
  <button
    type="button"
    class="book-nav-btn prev-btn"
    onclick={() => flipPage('backward')}
    aria-label="Obra anterior"
  >
    <ChevronLeft size={22} />
  </button>

  <button
    type="button"
    class="book-nav-btn next-btn"
    onclick={() => flipPage('forward')}
    aria-label="Próxima obra"
  >
    <ChevronRight size={22} />
  </button>

  <!-- ========================================================
       DESKTOP EDITORIAL BOOK (Visible >= 768px)
       Physical 3D Open Grimoire Powered by StPageFlip Real Page Curl
       Width aligned with .home-content (max-width: 1376px)
       ======================================================== -->
  <div class="desktop-stage">
    <div class="nox-book-shell-wrap">
      <!-- Hardcover Backing Shell, Paper Edges & Center Crease Spine -->
      <div class="book-hardcover-shell" aria-hidden="true">
        <div class="book-edge-stack book-edge-left"></div>
        <div class="book-edge-stack book-edge-right"></div>
        <div class="book-spine-crease"></div>
      </div>

      <!-- Container hosting StPageFlip -->
      <div class="nox-book-container">
        <div class="nox-book-pages-wrapper" bind:this={bookEl}>
          {#each displayWorks as work, idx (work.id)}
            <!-- LEFT PAGE: HERO ARTWORK -->
            <div class="nox-stf-page left-page" data-density="soft">
              {@render desktopArtwork(work)}
              <div class="page-crease-shadow"></div>
            </div>

            <!-- RIGHT PAGE: EDITORIAL CHRONICLE -->
            <div class="nox-stf-page right-page" data-density="soft">
              {@render desktopChronicle(work)}
              <div class="page-crease-shadow"></div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================
       MOBILE EDITORIAL FOLIO (Visible < 768px)
       Vertical Folio Card with Touch Gestures: Zero blank screens,
       zero 3D matrix flattening.
       ======================================================== -->
  <div class="mobile-stage" use:bindMobileTouch>
    {#if currentWork}
      {@const mobileContItem = getContinueItem(currentWork)}
      <div class="mobile-card">
        <!-- Top Half: Large Artwork Hero -->
        <div class="mobile-cover-box">
          <img
            src={getCover(currentWork, 'hero')}
            alt={currentWork.title}
            class="mobile-cover-image"
            class:nsfw-blur={getIsAdult(currentWork) && (page.data?.blurNsfw ?? true)}
            use:fallbackCover
            loading="eager"
            decoding="async"
          />
          <div class="mobile-cover-vignette"></div>

          <!-- Mobile Quick Nav Arrows on Cover -->
          <button
            type="button"
            class="mobile-cover-arrow cover-arrow-prev"
            onclick={() => flipPage('backward')}
            aria-label="Obra anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            class="mobile-cover-arrow cover-arrow-next"
            onclick={() => flipPage('forward')}
            aria-label="Próxima obra"
          >
            <ChevronRight size={18} />
          </button>

          <!-- Top Overlay Badges -->
          <div class="mobile-top-badges">
            {#if currentWork.kind}
              <span class="editorial-badge kind-badge">
                {kindLabels[currentWork.kind] || currentWork.kind}
              </span>
            {/if}
            {#if getIsAdult(currentWork)}
              <span class="editorial-badge adult-badge">
                <AlertTriangle size={11} />
                <span>+18</span>
              </span>
            {/if}
          </div>
        </div>

        <!-- Bottom Half: Editorial Info & Action -->
        <div class="mobile-info-box">
          <div class="mobile-header-meta">
            <span class="meta-brand">
              <Sparkles size={12} class="accent-star" />
              <span>Project Nox</span>
            </span>
            <span class="meta-views">
              <Eye size={12} />
              <span>{formatViews(currentWork.views)} leituras</span>
            </span>
          </div>

          <h2 class="mobile-title">
            <a href="/obra/{currentWork.slug}">{currentWork.title}</a>
          </h2>

          <div class="mobile-pills">
            {#if currentWork.status}
              <span class="editorial-pill status-pill">
                {currentWork.status === 'COMPLETED' ? 'Concluído' : 'Em Lançamento'}
              </span>
            {/if}
            {#if (currentWork as any).total_chapters || (currentWork as any).chapters_count}
              <span class="editorial-pill">
                {(currentWork as any).total_chapters || (currentWork as any).chapters_count} Caps
              </span>
            {/if}
          </div>

          <p class="mobile-synopsis">
            {#if currentWork.synopsis}
              {decodeHtmlEntities(currentWork.synopsis)}
            {:else}
              Acompanhe esta jornada exclusiva com leitura contínua e qualidade no Project Nox.
            {/if}
          </p>

          <div class="mobile-actions">
            <a
              href={mobileContItem ? mobileContItem.destinationUrl : `/obra/${currentWork.slug}`}
              class="editorial-btn btn-solid"
            >
              <BookOpen size={16} />
              <span>{mobileContItem ? 'Continuar Leitura' : 'Ler Agora'}</span>
            </a>
            <a href="/obra/{currentWork.slug}" class="editorial-btn btn-outline">
              <span>Detalhes</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- ========================================================
       BOOK FOOTER & FOLIO INDICATORS
       Synchronized across all 10 works with progress pips
       ======================================================== -->
  <div class="book-footer">
    <div class="footer-left-info">
      <Compass size={13} class="compass-icon" />
      <span class="folio-count">
        Folha <strong class="current-folio">{String(currentIndex + 1).padStart(2, '0')}</strong> de {displayWorks.length}
      </span>
      <span class="status-indicator" class:paused={isPaused}>
        <span class="pulse-beacon"></span>
        <span class="status-text">{isPaused ? 'Pausado' : 'Folheando'}</span>
      </span>
    </div>

    <!-- Quick Indicator Pips -->
    <div class="footer-pips" role="tablist" aria-label="Navegar pelas 10 obras do livro">
      {#each displayWorks as w, idx}
        <button
          type="button"
          class="pip-button"
          class:active={idx === currentIndex}
          onclick={() => goToWork(idx)}
          aria-label="Ir para obra {idx + 1}: {w.title}"
          role="tab"
          aria-selected={idx === currentIndex}
        >
          <span class="pip-line"></span>
        </button>
      {/each}
    </div>
  </div>
</section>

<!-- ========================================================
     SNIPPET: Desktop Artwork (Left Page)
     Centerpiece high-resolution artwork, pristine 2:3 ratio,
     luxury presentation with ambient drop shadow.
     ======================================================== -->
{#snippet desktopArtwork(work: Work)}
  <div class="desktop-art-canvas">
    <div class="cover-art-wrapper">
      <img
        src={getCover(work, 'hero')}
        alt={work.title}
        class="cover-image-art"
        class:nsfw-blur={getIsAdult(work) && (page.data?.blurNsfw ?? true)}
        use:fallbackCover
        loading="eager"
        decoding="async"
      />
      <!-- Clean editorial badges -->
      <div class="cover-badge-row">
        {#if work.kind}
          <span class="editorial-badge kind-badge">
            {kindLabels[work.kind] || work.kind}
          </span>
        {/if}
        {#if getIsAdult(work)}
          <span class="editorial-badge adult-badge">
            <AlertTriangle size={11} />
            <span>+18</span>
          </span>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

<!-- ========================================================
     SNIPPET: Desktop Chronicle (Right Page)
     Modern editorial typography, generous breathing room,
     clamped synopsis and high-contrast call-to-actions.
     ======================================================== -->
{#snippet desktopChronicle(work: Work)}
  {@const contItem = getContinueItem(work)}
  <div class="desktop-chronicle-canvas">
    <div class="chronicle-top-bar">
      <span class="brand-eyebrow">
        <Sparkles size={13} class="accent-star" />
        <span>PROJECT NOX • VITRINE DO ACERVO</span>
      </span>
      <span class="stats-views">
        <Eye size={13} />
        <span>{formatViews(work.views)} leituras</span>
      </span>
    </div>

    <h1 class="chronicle-main-title">
      <a href="/obra/{work.slug}" title={work.title}>
        {work.title}
      </a>
    </h1>

    <div class="chronicle-tags-row">
      {#if work.status}
        <span class="editorial-pill status-pill">
          {work.status === 'COMPLETED' ? 'Concluído' : 'Em Lançamento'}
        </span>
      {/if}
      {#if (work as any).total_chapters || (work as any).chapters_count}
        <span class="editorial-pill">
          {(work as any).total_chapters || (work as any).chapters_count} Capítulos
        </span>
      {/if}
    </div>

    <div class="synopsis-wrapper">
      <p class="synopsis-paragraph">
        {#if work.synopsis}
          {decodeHtmlEntities(work.synopsis)}
        {:else}
          Mergulhe em uma narrativa envolvente e de alta qualidade visual, com leitura contínua no Project Nox.
        {/if}
      </p>
    </div>

    {#if contItem}
      <div class="reading-progress-pill">
        <BookOpen size={13} />
        <span>Você tem leitura em andamento nesta obra</span>
      </div>
    {/if}

    <div class="chronicle-actions-row">
      <a
        href={contItem ? contItem.destinationUrl : `/obra/${work.slug}`}
        class="editorial-btn btn-solid"
      >
        <BookOpen size={16} />
        <span>{contItem ? 'Continuar Leitura' : 'Ler Agora'}</span>
      </a>

      <a href="/obra/{work.slug}" class="editorial-btn btn-outline">
        <span>Detalhes da Obra</span>
        <ArrowRight size={14} />
      </a>
    </div>
  </div>
{/snippet}

<style>
  /* -------------------------------------------------------------
     1. MAIN SECTION & AMBIENT BACKDROP
     Aligned with .home-content (max-width: 1440px)
     ------------------------------------------------------------- */
  .nox-book-section {
    position: relative;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 2.2rem 2rem 1.6rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    z-index: 10;
    user-select: none;
  }

  .book-ambient-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 85%;
    height: 70%;
    background: radial-gradient(
      ellipse at center,
      rgba(139, 92, 246, 0.15) 0%,
      rgba(99, 102, 241, 0.05) 50%,
      transparent 72%
    );
    border-radius: 50%;
    filter: blur(50px);
    pointer-events: none;
    z-index: 0;
  }

  /* -------------------------------------------------------------
     2. NAVIGATION ARROWS (DESKTOP)
     ------------------------------------------------------------- */
  .book-nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: rgba(14, 12, 26, 0.9);
    border: 1px solid rgba(139, 92, 246, 0.32);
    color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 30;
    transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
  }

  .book-nav-btn:hover {
    background: rgba(139, 92, 246, 0.28);
    border-color: rgba(168, 85, 247, 0.7);
    color: #ffffff;
    box-shadow: 0 0 24px rgba(139, 92, 246, 0.5);
    transform: translateY(-50%) scale(1.08);
  }

  .prev-btn {
    left: 0.25rem;
  }

  .next-btn {
    right: 0.25rem;
  }

  /* -------------------------------------------------------------
     3. DESKTOP STAGE & HARDCOVER CASING
     Width matched to inner .home-content (max-width: 1376px)
     ------------------------------------------------------------- */
  .desktop-stage {
    display: flex;
    width: 100%;
    justify-content: center;
    align-items: center;
    z-index: 10;
  }

  .nox-book-shell-wrap {
    position: relative;
    width: 100%;
    max-width: 1376px;
  }

  .book-hardcover-shell {
    position: absolute;
    inset: -8px -10px;
    border-radius: 14px;
    background: linear-gradient(135deg, #07060e 0%, #0d0a1c 50%, #06050c 100%);
    border: 1px solid rgba(139, 92, 246, 0.22);
    box-shadow:
      0 32px 75px -15px rgba(0, 0, 0, 0.95),
      0 0 50px rgba(124, 58, 237, 0.12),
      inset 0 1px 1px rgba(255, 255, 255, 0.08);
    pointer-events: none;
    z-index: 1;
  }

  .book-edge-stack {
    position: absolute;
    top: 14px;
    bottom: 14px;
    width: 10px;
    background: repeating-linear-gradient(
      to bottom,
      #121020 0px,
      #121020 1px,
      #231e38 1px,
      #231e38 2px
    );
    opacity: 0.85;
  }

  .book-edge-left {
    left: -5px;
    border-radius: 4px 0 0 4px;
    box-shadow: inset 1px 0 3px rgba(0, 0, 0, 0.8);
  }

  .book-edge-right {
    right: -5px;
    border-radius: 0 4px 4px 0;
    box-shadow: inset -1px 0 3px rgba(0, 0, 0, 0.8);
  }

  .book-spine-crease {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(50% - 12px);
    width: 24px;
    background: linear-gradient(
      to right,
      rgba(6, 5, 12, 0.95) 0%,
      rgba(20, 15, 36, 0.98) 50%,
      rgba(6, 5, 12, 0.95) 100%
    );
    border-left: 1px solid rgba(139, 92, 246, 0.15);
    border-right: 1px solid rgba(139, 92, 246, 0.15);
    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.9);
    z-index: 2;
    pointer-events: none;
  }

  .nox-book-container {
    position: relative;
    width: 100%;
    height: 560px;
    z-index: 5;
    border-radius: 10px;
    overflow: hidden;
  }

  .nox-book-pages-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* -------------------------------------------------------------
     4. STPAGEFLIP PAGE STYLING (Real Paper Curl)
     ------------------------------------------------------------- */
  :global(.stf__parent) {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 100% !important;
    height: 100% !important;
  }

  :global(.sft__wrapper) {
    position: relative;
    width: 100% !important;
    height: 100% !important;
    box-sizing: border-box;
  }

  :global(.stf__block) {
    position: absolute;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }

  :global(.stf__item) {
    box-sizing: border-box;
  }

  .nox-stf-page {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    background: #0d0b1a;
  }

  .nox-stf-page.left-page {
    background: linear-gradient(135deg, #100d20 0%, #0c0a18 100%);
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }

  .nox-stf-page.right-page {
    background: linear-gradient(135deg, #0c0a18 0%, #100d20 100%);
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  .page-crease-shadow {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 36px;
    pointer-events: none;
    z-index: 15;
  }

  .left-page .page-crease-shadow {
    right: 0;
    background: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.55) 100%);
  }

  .right-page .page-crease-shadow {
    left: 0;
    background: linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.55) 100%);
  }

  /* -------------------------------------------------------------
     5. DESKTOP ARTWORK (LEFT PAGE)
     ------------------------------------------------------------- */
  .desktop-art-canvas {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 2.5rem;
    box-sizing: border-box;
  }

  .cover-art-wrapper {
    position: relative;
    width: 320px;
    height: 480px;
    max-height: 86%;
    aspect-ratio: 2 / 3;
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 20px 48px -8px rgba(0, 0, 0, 0.88),
      0 0 28px rgba(139, 92, 246, 0.28),
      0 0 0 1px rgba(139, 92, 246, 0.35);
  }

  .cover-image-art {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-badge-row {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    gap: 6px;
    z-index: 10;
    pointer-events: none;
  }

  .editorial-badge {
    padding: 0.28rem 0.65rem;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    backdrop-filter: blur(8px);
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .kind-badge {
    background: rgba(139, 92, 246, 0.3);
    color: #e9d5ff;
    border: 1px solid rgba(168, 85, 247, 0.5);
  }

  .adult-badge {
    background: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.5);
  }

  .nsfw-blur {
    filter: blur(14px);
    transition: filter 0.3s ease;
  }

  /* -------------------------------------------------------------
     6. DESKTOP CHRONICLE (RIGHT PAGE)
     ------------------------------------------------------------- */
  .desktop-chronicle-canvas {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 3.5rem 3.5rem 3.5rem 2.8rem;
    box-sizing: border-box;
    position: relative;
  }

  .chronicle-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    margin-bottom: 0.85rem;
  }

  .brand-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.76rem;
    font-weight: 750;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #a78bfa;
  }

  .accent-star {
    color: #c084fc;
  }

  .stats-views {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 550;
  }

  .chronicle-main-title {
    margin: 0 0 0.9rem;
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.15rem;
    line-height: 1.18;
    font-weight: 850;
    letter-spacing: -0.025em;
  }

  .chronicle-main-title a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease, text-shadow 0.2s ease;
  }

  .chronicle-main-title a:hover {
    color: #f5f3ff;
    text-shadow: 0 0 20px rgba(167, 139, 250, 0.4);
  }

  .chronicle-tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.15rem;
  }

  .editorial-pill {
    padding: 0.3rem 0.75rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.78rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .status-pill {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.28);
    color: #c4b5fd;
  }

  .synopsis-wrapper {
    margin-bottom: 1.6rem;
    max-width: 540px;
  }

  .synopsis-paragraph {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.62;
    color: #c4c8d8;
    font-weight: 450;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reading-progress-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #86efac;
    padding: 0.32rem 0.75rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    margin-bottom: 1.2rem;
    align-self: flex-start;
  }

  .chronicle-actions-row {
    display: flex;
    gap: 0.85rem;
    align-items: center;
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .editorial-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    border-radius: 8px;
    font-size: 0.92rem;
    font-weight: 650;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .btn-solid {
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    padding: 0.72rem 1.45rem;
    border: 1px solid rgba(168, 85, 247, 0.4);
    box-shadow: 0 4px 18px rgba(124, 58, 237, 0.45);
  }

  .btn-solid:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.6);
    color: #ffffff;
  }

  .btn-outline {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #e2e8f0;
    padding: 0.72rem 1.35rem;
  }

  .btn-outline:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(168, 85, 247, 0.6);
    color: #ffffff;
    transform: translateY(-2px);
  }

  /* -------------------------------------------------------------
     7. MOBILE EDITORIAL FOLIO (Visible < 768px)
     Robust vertical layout with swipe gestures
     ------------------------------------------------------------- */
  .mobile-stage {
    display: none;
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    z-index: 10;
  }

  .mobile-card {
    background: linear-gradient(180deg, #100d22 0%, #0b0916 100%);
    border: 1px solid rgba(139, 92, 246, 0.28);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .mobile-cover-box {
    position: relative;
    width: 100%;
    height: 280px;
    background: #07060e;
    overflow: hidden;
  }

  .mobile-cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .mobile-cover-vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.25) 0%,
      transparent 40%,
      #100d22 100%
    );
    pointer-events: none;
  }

  .mobile-top-badges {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 6px;
    z-index: 10;
  }

  .mobile-cover-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(10, 8, 18, 0.85);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 15;
    backdrop-filter: blur(6px);
  }

  .cover-arrow-prev {
    left: 8px;
  }

  .cover-arrow-next {
    right: 8px;
  }

  .mobile-info-box {
    padding: 1.25rem 1.2rem 1.4rem;
    display: flex;
    flex-direction: column;
  }

  .mobile-header-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .meta-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #a78bfa;
  }

  .meta-views {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .mobile-title {
    margin: 0 0 0.6rem;
    font-size: 1.35rem;
    line-height: 1.25;
    font-weight: 850;
  }

  .mobile-title a {
    color: #ffffff;
    text-decoration: none;
  }

  .mobile-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  }

  .mobile-synopsis {
    margin: 0 0 1.2rem;
    font-size: 0.86rem;
    line-height: 1.55;
    color: #94a3b8;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .mobile-actions {
    display: flex;
    gap: 0.65rem;
  }

  .mobile-actions .editorial-btn {
    flex: 1;
    padding: 0.65rem 0.8rem;
    font-size: 0.86rem;
  }

  /* -------------------------------------------------------------
     8. BOOK FOOTER & PROGRESS PIPS
     ------------------------------------------------------------- */
  .book-footer {
    width: 100%;
    max-width: 1376px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1.25rem;
    padding: 0 0.5rem;
    box-sizing: border-box;
    z-index: 10;
  }

  .footer-left-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #94a3b8;
    font-size: 0.82rem;
  }

  .compass-icon {
    color: #a78bfa;
  }

  .current-folio {
    color: #f1f5f9;
    font-weight: 750;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #86efac;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.25);
    padding: 0.18rem 0.55rem;
    border-radius: 9999px;
    transition: all 0.2s ease;
  }

  .status-indicator.paused {
    color: #fde047;
    background: rgba(234, 179, 8, 0.1);
    border-color: rgba(234, 179, 8, 0.25);
  }

  .pulse-beacon {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 6px currentColor;
    animation: beaconPulse 2s infinite ease-in-out;
  }

  @keyframes beaconPulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.85);
    }
  }

  .footer-pips {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .pip-button {
    background: none;
    border: none;
    padding: 0.4rem 0.15rem;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .pip-line {
    width: 18px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.18);
    transition: all 0.25s ease;
  }

  .pip-button:hover .pip-line {
    background: rgba(167, 139, 250, 0.5);
  }

  .pip-button.active .pip-line {
    width: 32px;
    background: linear-gradient(90deg, #7c3aed, #a855f7);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.7);
  }

  /* -------------------------------------------------------------
     9. RESPONSIVE BREAKPOINTS
     ------------------------------------------------------------- */
  @media (max-width: 1024px) {
    .cover-art-wrapper {
      width: 270px;
      height: 405px;
    }

    .chronicle-main-title {
      font-size: 1.75rem;
    }

    .synopsis-paragraph {
      -webkit-line-clamp: 4;
    }

    .desktop-chronicle-canvas {
      padding: 2.2rem 2.2rem 2.2rem 1.8rem;
    }
  }

  @media (max-width: 767px) {
    .nox-book-section {
      padding: 1.25rem 1rem 1.25rem;
    }

    .book-nav-btn {
      display: none;
    }

    .desktop-stage {
      display: none;
    }

    .mobile-stage {
      display: block;
    }

    .book-footer {
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;
      margin-top: 1rem;
    }

    .footer-pips {
      gap: 0.35rem;
    }

    .pip-line {
      width: 12px;
      height: 3px;
    }

    .pip-button.active .pip-line {
      width: 22px;
    }
  }
</style>
