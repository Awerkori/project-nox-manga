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

  // Active state
  let currentIndex = $state(0);
  let nextIndex = $state(0);
  let isFlipping = $state(false);
  let flipDirection = $state<'forward' | 'backward'>('forward');
  let isPaused = $state(false);
  let prefersReducedMotion = $state(false);

  // Timing configuration
  const READING_TIME_MS = 3000; // Exactly 3.0s display per work
  const FLIP_DURATION_MS = 700; // 700ms smooth realistic page turn

  let timerStartTime = 0;
  let remainingTime = READING_TIME_MS;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  // Active works
  let currentWork = $derived(works.length > 0 ? works[currentIndex % works.length] : null);
  let targetWork = $derived(works.length > 0 ? works[nextIndex % works.length] : null);
  let prevIndexCalc = $derived((currentIndex - 1 + works.length) % works.length);
  let nextIndexCalc = $derived((currentIndex + 1) % works.length);

  // Pointer & Touch Gestures
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;
  let touchDeltaY = 0;
  let pointerStartX = 0;
  let pointerStartY = 0;

  function handlePointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pauseReadingTimer();
  }

  function handlePointerUp(e: PointerEvent) {
    const deltaX = e.clientX - pointerStartX;
    const deltaY = e.clientY - pointerStartY;
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      if (deltaX < 0) {
        flipPage('forward', true);
      } else {
        flipPage('backward', true);
      }
    }
    resumeReadingTimer();
  }

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
    if (works.length <= 1 || isPaused) return;
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
      remainingTime = Math.max(300, remainingTime - elapsed);
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
  function flipPage(direction: 'forward' | 'backward', manual = false) {
    if (isFlipping || works.length <= 1) return;

    clearReadingTimer();
    flipDirection = direction;
    nextIndex = direction === 'forward' ? nextIndexCalc : prevIndexCalc;
    isFlipping = true;

    // Trigger subtle cosmic shimmer in background
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nox:book-flip', {
          detail: { direction, fromIndex: currentIndex, toIndex: nextIndex }
        })
      );
    }

    if (prefersReducedMotion) {
      currentIndex = nextIndex;
      isFlipping = false;
      if (!isPaused) startReadingTimer(READING_TIME_MS);
      return;
    }

    setTimeout(() => {
      currentIndex = nextIndex;
      isFlipping = false;
      remainingTime = READING_TIME_MS;
      if (!isPaused) {
        startReadingTimer(READING_TIME_MS);
      }
    }, FLIP_DURATION_MS);
  }

  function goToWork(idx: number) {
    if (isFlipping || idx === currentIndex || idx < 0 || idx >= works.length) return;
    const direction = idx > currentIndex ? 'forward' : 'backward';
    clearReadingTimer();
    flipDirection = direction;
    nextIndex = idx;
    isFlipping = true;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nox:book-flip', {
          detail: { direction, fromIndex: currentIndex, toIndex: nextIndex }
        })
      );
    }

    if (prefersReducedMotion) {
      currentIndex = nextIndex;
      isFlipping = false;
      if (!isPaused) startReadingTimer(READING_TIME_MS);
      return;
    }

    setTimeout(() => {
      currentIndex = nextIndex;
      isFlipping = false;
      remainingTime = READING_TIME_MS;
      if (!isPaused) {
        startReadingTimer(READING_TIME_MS);
      }
    }, FLIP_DURATION_MS);
  }

  // Keyboard Navigation
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      flipPage('forward', true);
    } else if (e.key === 'ArrowLeft') {
      flipPage('backward', true);
    }
  }

  // Touch Swipe on Mobile
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
        flipPage('forward', true);
      } else {
        flipPage('backward', true);
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

  // Action Helpers for CSP & Event Binding
  function bindBookEvents(node: HTMLElement) {
    node.addEventListener('mouseenter', pauseReadingTimer);
    node.addEventListener('mouseleave', resumeReadingTimer);
    node.addEventListener('pointerdown', handlePointerDown);
    node.addEventListener('pointerup', handlePointerUp);
    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: true });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });

    return {
      destroy() {
        node.removeEventListener('mouseenter', pauseReadingTimer);
        node.removeEventListener('mouseleave', resumeReadingTimer);
        node.removeEventListener('pointerdown', handlePointerDown);
        node.removeEventListener('pointerup', handlePointerUp);
        node.removeEventListener('touchstart', handleTouchStart);
        node.removeEventListener('touchmove', handleTouchMove);
        node.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }

  function bindClick(node: HTMLElement, action: () => void) {
    let fn = action;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      fn();
    };
    node.addEventListener('click', handler);
    return {
      update(newAction: () => void) {
        fn = newAction;
      },
      destroy() {
        node.removeEventListener('click', handler);
      }
    };
  }

  onMount(() => {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startReadingTimer(READING_TIME_MS);
  });

  onDestroy(() => {
    clearReadingTimer();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<section
  class="nox-book-section"
  aria-label="Nox Book — Vitrine Editorial Interativa"
  use:bindBookEvents
>
  <!-- Ambient Cosmic Aura behind Book -->
  <div class="book-ambient-glow" aria-hidden="true"></div>

  <!-- Outer Navigation Arrows (Desktop) -->
  <button
    type="button"
    class="book-nav-btn prev-btn"
    use:bindClick={() => flipPage('backward', true)}
    disabled={isFlipping}
    aria-label="Obra anterior"
  >
    <ChevronLeft size={22} />
  </button>

  <button
    type="button"
    class="book-nav-btn next-btn"
    use:bindClick={() => flipPage('forward', true)}
    disabled={isFlipping}
    aria-label="Próxima obra"
  >
    <ChevronRight size={22} />
  </button>

  <!-- ========================================================
       DESKTOP EDITORIAL BOOK (Visible >= 768px)
       ======================================================== -->
  <div class="nox-book-stage desktop-stage">
    <div class="nox-book" class:flipping={isFlipping}>
      <!-- Hardcover Outer Shell & Stacked Paper Layers -->
      <div class="book-shell" aria-hidden="true">
        <div class="edge-stack edge-left"></div>
        <div class="edge-stack edge-right"></div>
        <div class="spine-binding"></div>
      </div>

      <!-- DESKTOP SPREAD (Two connected pages) -->
      <div class="book-spread">
        <!-- STATIC LEFT PAGE (Underneath / Base Artwork) -->
        <div class="book-page left-page">
          {#if isFlipping && flipDirection === 'backward' && targetWork}
            {@render desktopArtwork(targetWork)}
          {:else if currentWork}
            {@render desktopArtwork(currentWork)}
          {/if}
          <div class="spine-crease-shadow crease-left"></div>
        </div>

        <!-- STATIC RIGHT PAGE (Underneath / Base Chronicle) -->
        <div class="book-page right-page">
          {#if isFlipping && flipDirection === 'forward' && targetWork}
            {@render desktopChronicle(targetWork)}
          {:else if currentWork}
            {@render desktopChronicle(currentWork)}
          {/if}
          <div class="spine-crease-shadow crease-right"></div>
          {#if isFlipping && flipDirection === 'forward'}
            <div class="cast-under-shadow"></div>
          {/if}
        </div>

        <!-- 3D TURNING LEAF (Active when flipping forward or backward) -->
        {#if isFlipping}
          {#if flipDirection === 'forward'}
            <div class="turning-leaf leaf-forward">
              <!-- Front Face: Current Chronicle (turns away) -->
              <div class="leaf-face front-face">
                {#if currentWork}
                  {@render desktopChronicle(currentWork)}
                {/if}
                <div class="leaf-sweep-shadow sweep-front"></div>
              </div>

              <!-- Back Face: Target Artwork (lands on left) -->
              <div class="leaf-face back-face">
                {#if targetWork}
                  {@render desktopArtwork(targetWork)}
                {/if}
                <div class="leaf-sweep-shadow sweep-back"></div>
              </div>
            </div>
          {:else}
            <div class="turning-leaf leaf-backward">
              <!-- Front Face: Current Artwork (turns away) -->
              <div class="leaf-face front-face">
                {#if currentWork}
                  {@render desktopArtwork(currentWork)}
                {/if}
                <div class="leaf-sweep-shadow sweep-front"></div>
              </div>

              <!-- Back Face: Target Chronicle (lands on right) -->
              <div class="leaf-face back-face">
                {#if targetWork}
                  {@render desktopChronicle(targetWork)}
                {/if}
                <div class="leaf-sweep-shadow sweep-back"></div>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>

  <!-- ========================================================
       MOBILE EDITORIAL FOLIO (Visible < 768px)
       Rock-solid layout: Zero 3D stacking bugs, zero blank screen.
       ======================================================== -->
  <div class="mobile-stage">
    {#if currentWork}
      {@const mobileContItem = getContinueItem(currentWork)}
      <div
        class="mobile-card"
        class:mobile-flip-out-left={isFlipping && flipDirection === 'forward'}
        class:mobile-flip-out-right={isFlipping && flipDirection === 'backward'}
      >
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
            use:bindClick={() => flipPage('backward', true)}
            aria-label="Obra anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            class="mobile-cover-arrow cover-arrow-next"
            use:bindClick={() => flipPage('forward', true)}
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
       ======================================================== -->
  <div class="book-footer">
    <div class="footer-left-info">
      <Compass size={13} class="compass-icon" />
      <span class="folio-count">
        Folha <strong class="current-folio">{String(currentIndex + 1).padStart(2, '0')}</strong> de {works.length}
      </span>
      <span class="status-indicator" class:paused={isPaused}>
        <span class="pulse-beacon"></span>
        <span class="status-text">{isPaused ? 'Pausado' : 'Folheando'}</span>
      </span>
    </div>

    <!-- Quick Indicator Pips -->
    <div class="footer-pips" role="tablist" aria-label="Navegar pelas 10 obras do livro">
      {#each works as w, idx}
        <button
          type="button"
          class="pip-button"
          class:active={idx === currentIndex}
          use:bindClick={() => goToWork(idx)}
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
     Gallery-quality prominence with clean modern frame.
     ======================================================== -->
{#snippet desktopArtwork(work: Work)}
  <div class="desktop-art-canvas">
    <div class="cover-art-wrapper">
      <div class="art-ambient-drop"></div>
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
     Modern editorial typography and clear action hierarchy.
     ======================================================== -->
{#snippet desktopChronicle(work: Work)}
  {@const contItem = getContinueItem(work)}
  <div class="desktop-chronicle-canvas">
    <div class="chronicle-top-bar">
      <span class="brand-eyebrow">
        <Sparkles size={12} class="accent-star" />
        <span>PROJECT NOX • VITRINE DO ACERVO</span>
      </span>
      <span class="stats-views">
        <Eye size={12} />
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
     ------------------------------------------------------------- */
  .nox-book-section {
    position: relative;
    width: 100%;
    max-width: 1240px;
    margin: 0 auto;
    padding: 2.2rem 1.5rem 1.6rem;
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
      rgba(139, 92, 246, 0.12) 0%,
      rgba(99, 102, 241, 0.05) 45%,
      transparent 72%
    );
    border-radius: 50%;
    filter: blur(40px);
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
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(14, 12, 24, 0.85);
    border: 1px solid rgba(139, 92, 246, 0.28);
    color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 30;
    transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
  }

  .book-nav-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(168, 85, 247, 0.65);
    color: #ffffff;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.45);
    transform: translateY(-50%) scale(1.08);
  }

  .book-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .prev-btn {
    left: 0.25rem;
  }

  .next-btn {
    right: 0.25rem;
  }

  /* -------------------------------------------------------------
     3. DESKTOP STAGE & 3D BOOK
     ------------------------------------------------------------- */
  .desktop-stage {
    display: flex;
    width: 100%;
    justify-content: center;
    align-items: center;
    perspective: 2200px;
    perspective-origin: center center;
    z-index: 10;
  }

  .nox-book {
    position: relative;
    width: 100%;
    max-width: 1060px;
    height: 520px;
    transform-style: preserve-3d;
  }

  /* Hardcover Shell & Layered Pages */
  .book-shell {
    position: absolute;
    inset: -6px;
    border-radius: 12px;
    background: linear-gradient(135deg, #090812 0%, #0d0a1b 50%, #07060e 100%);
    border: 1px solid rgba(139, 92, 246, 0.24);
    box-shadow:
      0 28px 65px -12px rgba(0, 0, 0, 0.95),
      0 0 40px rgba(124, 58, 237, 0.1),
      inset 0 1px 1px rgba(255, 255, 255, 0.08);
    pointer-events: none;
    z-index: 1;
  }

  .edge-stack {
    position: absolute;
    top: 12px;
    bottom: 12px;
    width: 8px;
    background: repeating-linear-gradient(
      to bottom,
      #131122 0px,
      #131122 1px,
      #221e35 1px,
      #221e35 2px
    );
    opacity: 0.8;
  }

  .edge-left {
    left: -3px;
    border-radius: 4px 0 0 4px;
    box-shadow: inset 1px 0 2px rgba(0, 0, 0, 0.8);
  }

  .edge-right {
    right: -3px;
    border-radius: 0 4px 4px 0;
    box-shadow: inset -1px 0 2px rgba(0, 0, 0, 0.8);
  }

  .spine-binding {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(50% - 10px);
    width: 20px;
    background: linear-gradient(
      to right,
      rgba(7, 6, 14, 0.95) 0%,
      rgba(24, 18, 42, 0.98) 50%,
      rgba(7, 6, 14, 0.95) 100%
    );
    border-left: 1px solid rgba(0, 0, 0, 0.9);
    border-right: 1px solid rgba(0, 0, 0, 0.9);
    z-index: 15;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.9);
  }

  /* -------------------------------------------------------------
     4. DESKTOP SPREAD (TWO CONNECTED PAGES)
     ------------------------------------------------------------- */
  .book-spread {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    transform-style: preserve-3d;
    z-index: 5;
  }

  .book-page {
    position: relative;
    width: 50%;
    height: 100%;
    background: #0e0c19;
    overflow: hidden;
    box-sizing: border-box;
  }

  .left-page {
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    background: linear-gradient(to right, #0e0c18 0%, #121021 92%, #090812 100%);
    box-shadow: inset -8px 0 16px -6px rgba(0, 0, 0, 0.85);
  }

  .right-page {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
    background: linear-gradient(to left, #0e0c18 0%, #131024 92%, #090812 100%);
    box-shadow: inset 8px 0 16px -6px rgba(0, 0, 0, 0.85);
  }

  .spine-crease-shadow {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 32px;
    pointer-events: none;
    z-index: 8;
  }

  .crease-left {
    right: 0;
    background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.85));
  }

  .crease-right {
    left: 0;
    background: linear-gradient(to left, transparent, rgba(0, 0, 0, 0.85));
  }

  .cast-under-shadow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 7;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.8) 0%, transparent 45%);
    animation: castDissolve 700ms ease-out forwards;
  }

  @keyframes castDissolve {
    0% {
      opacity: 0.9;
    }
    50% {
      opacity: 0.45;
    }
    100% {
      opacity: 0;
    }
  }

  /* -------------------------------------------------------------
     5. 3D TURNING LEAF (PHYSICS ARCS)
     ------------------------------------------------------------- */
  .turning-leaf {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    height: 100%;
    transform-style: preserve-3d;
    z-index: 20;
    pointer-events: none;
  }

  .leaf-forward {
    left: 50%;
    transform-origin: left center;
    animation: forwardFlipCurl 700ms cubic-bezier(0.28, 0.95, 0.35, 1) forwards;
  }

  .leaf-backward {
    left: 0;
    transform-origin: right center;
    animation: backwardFlipCurl 700ms cubic-bezier(0.28, 0.95, 0.35, 1) forwards;
  }

  @keyframes forwardFlipCurl {
    0% {
      transform: rotateY(0deg) skewY(0deg) translateZ(0px);
    }
    30% {
      transform: rotateY(-50deg) skewY(-2deg) translateZ(30px);
    }
    55% {
      transform: rotateY(-95deg) skewY(0deg) translateZ(40px);
    }
    80% {
      transform: rotateY(-145deg) skewY(2deg) translateZ(20px);
    }
    100% {
      transform: rotateY(-180deg) skewY(0deg) translateZ(0px);
    }
  }

  @keyframes backwardFlipCurl {
    0% {
      transform: rotateY(0deg) skewY(0deg) translateZ(0px);
    }
    30% {
      transform: rotateY(50deg) skewY(2deg) translateZ(30px);
    }
    55% {
      transform: rotateY(95deg) skewY(0deg) translateZ(40px);
    }
    80% {
      transform: rotateY(145deg) skewY(-2deg) translateZ(20px);
    }
    100% {
      transform: rotateY(180deg) skewY(0deg) translateZ(0px);
    }
  }

  .leaf-face {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    overflow: hidden;
    background: #0e0c19;
  }

  .front-face {
    transform: rotateY(0deg);
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  .back-face {
    transform: rotateY(180deg);
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
  }

  .leaf-sweep-shadow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .sweep-front {
    animation: sweepFrontKeyframe 700ms ease-out forwards;
  }

  .sweep-back {
    animation: sweepBackKeyframe 700ms ease-out forwards;
  }

  @keyframes sweepFrontKeyframe {
    0% {
      background: linear-gradient(to right, rgba(0, 0, 0, 0.4), transparent 60%);
      opacity: 0.2;
    }
    45% {
      background: linear-gradient(
        to right,
        rgba(0, 0, 0, 0.75) 0%,
        rgba(255, 255, 255, 0.15) 45%,
        rgba(0, 0, 0, 0.85) 100%
      );
      opacity: 0.85;
    }
    100% {
      background: linear-gradient(to right, rgba(0, 0, 0, 0.95), transparent);
      opacity: 1;
    }
  }

  @keyframes sweepBackKeyframe {
    0% {
      background: linear-gradient(to left, rgba(0, 0, 0, 0.95), transparent);
      opacity: 1;
    }
    55% {
      background: linear-gradient(
        to left,
        rgba(0, 0, 0, 0.75) 0%,
        rgba(255, 255, 255, 0.15) 45%,
        rgba(0, 0, 0, 0.85) 100%
      );
      opacity: 0.8;
    }
    100% {
      background: linear-gradient(to left, rgba(0, 0, 0, 0.35), transparent 60%);
      opacity: 0.15;
    }
  }

  /* -------------------------------------------------------------
     6. DESKTOP ARTWORK CANVAS (LEFT PAGE)
     ------------------------------------------------------------- */
  .desktop-art-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 2.2rem 2.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .cover-art-wrapper {
    position: relative;
    width: 260px;
    height: 385px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow:
      0 20px 45px -10px rgba(0, 0, 0, 0.9),
      0 0 32px rgba(139, 92, 246, 0.16),
      0 0 0 1px rgba(139, 92, 246, 0.28);
    background: #090812;
  }

  .cover-image-art {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  .cover-image-art.nsfw-blur {
    filter: blur(14px);
  }

  .art-ambient-drop {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.55);
    pointer-events: none;
    z-index: 2;
  }

  .cover-badge-row {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 5;
    pointer-events: none;
  }

  .editorial-badge {
    padding: 0.28rem 0.6rem;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(6px);
  }

  .kind-badge {
    background: rgba(139, 92, 246, 0.9);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .adult-badge {
    background: rgba(225, 29, 72, 0.92);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* -------------------------------------------------------------
     7. DESKTOP CHRONICLE CANVAS (RIGHT PAGE)
     ------------------------------------------------------------- */
  .desktop-chronicle-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 2.8rem 2.8rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-sizing: border-box;
    color: #f1f5f9;
  }

  .chronicle-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
  }

  .brand-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c084fc;
  }

  :global(.accent-star) {
    color: #a855f7;
  }

  .stats-views {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .chronicle-main-title {
    margin: 0 0 0.85rem 0;
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1.24;
    letter-spacing: -0.02em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .chronicle-main-title a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .chronicle-main-title a:hover {
    color: #c084fc;
  }

  .chronicle-tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-bottom: 1.1rem;
  }

  .editorial-pill {
    padding: 0.22rem 0.65rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
    background: rgba(30, 27, 46, 0.85);
    border: 1px solid rgba(139, 92, 246, 0.22);
    color: #cbd5e1;
  }

  .status-pill {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.35);
    color: #34d399;
  }

  .synopsis-wrapper {
    margin-bottom: 1.3rem;
    max-height: 110px;
    overflow: hidden;
  }

  .synopsis-paragraph {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.6;
    color: #94a3b8;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reading-progress-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 1rem;
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    font-size: 0.75rem;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.35);
    color: #93c5fd;
  }

  .chronicle-actions-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .editorial-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.65rem 1.35rem;
    border-radius: 6px;
    font-size: 0.88rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .btn-solid {
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    box-shadow: 0 4px 18px rgba(124, 58, 237, 0.38);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn-solid:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.55);
    transform: translateY(-1px);
  }

  .btn-outline {
    background: rgba(22, 19, 36, 0.8);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #e2e8f0;
  }

  .btn-outline:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(168, 85, 247, 0.6);
    color: #ffffff;
  }

  /* -------------------------------------------------------------
     8. MOBILE STAGE & CARD (ROCK SOLID VISIBILITY ON ALL MOBILES)
     ------------------------------------------------------------- */
  .mobile-stage {
    display: none; /* Desktop default */
    width: 100%;
    max-width: 440px;
    box-sizing: border-box;
  }

  .mobile-card {
    position: relative;
    width: 100%;
    background: #0f0d1a;
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 16px 40px -10px rgba(0, 0, 0, 0.95),
      0 0 25px rgba(124, 58, 237, 0.12);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease;
  }

  .mobile-flip-out-left {
    transform: translateX(-15px) scale(0.97);
    opacity: 0.65;
  }

  .mobile-flip-out-right {
    transform: translateX(15px) scale(0.97);
    opacity: 0.65;
  }

  .mobile-cover-box {
    position: relative;
    width: 100%;
    height: 320px;
    background: #07060e;
    overflow: hidden;
  }

  .mobile-cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  .mobile-cover-image.nsfw-blur {
    filter: blur(14px);
  }

  .mobile-cover-vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(15, 13, 26, 0.1) 0%,
      rgba(15, 13, 26, 0.35) 60%,
      #0f0d1a 100%
    );
    pointer-events: none;
  }

  .mobile-top-badges {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 5;
    pointer-events: none;
  }

  .mobile-cover-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(14, 12, 24, 0.78);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 6;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    transition: transform 0.18s ease, background 0.18s ease;
  }

  .mobile-cover-arrow:active {
    transform: translateY(-50%) scale(0.92);
  }

  .cover-arrow-prev {
    left: 10px;
  }

  .cover-arrow-next {
    right: 10px;
  }

  .mobile-info-box {
    position: relative;
    width: 100%;
    padding: 1.1rem 1.25rem 1.35rem;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .mobile-header-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .meta-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #c084fc;
  }

  .meta-views {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .mobile-title {
    margin: 0 0 0.6rem 0;
    font-size: 1.4rem;
    font-weight: 800;
    line-height: 1.25;
    letter-spacing: -0.02em;
  }

  .mobile-title a {
    color: #ffffff;
    text-decoration: none;
  }

  .mobile-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.85rem;
  }

  .mobile-synopsis {
    margin: 0 0 1.15rem 0;
    font-size: 0.82rem;
    line-height: 1.55;
    color: #94a3b8;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-actions {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .mobile-actions .editorial-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }

  /* -------------------------------------------------------------
     9. BOOK FOOTER & PAGINATION CONTROLS
     ------------------------------------------------------------- */
  .book-footer {
    width: 100%;
    max-width: 1060px;
    margin-top: 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.5rem;
    box-sizing: border-box;
  }

  .footer-left-info {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.82rem;
    color: #94a3b8;
  }

  :global(.compass-icon) {
    color: #a855f7;
  }

  .current-folio {
    color: #e2e8f0;
    font-weight: 700;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: 0.8rem;
    padding: 0.18rem 0.55rem;
    border-radius: 9999px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    font-size: 0.7rem;
    color: #c084fc;
    transition: all 0.2s ease;
  }

  .status-indicator.paused {
    background: rgba(234, 179, 8, 0.12);
    border-color: rgba(234, 179, 8, 0.3);
    color: #facc15;
  }

  .pulse-beacon {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #a855f7;
    animation: beaconBlink 1.8s infinite;
  }

  .status-indicator.paused .pulse-beacon {
    background: #eab308;
    animation: none;
  }

  @keyframes beaconBlink {
    0%, 100% {
      opacity: 0.4;
      transform: scale(0.9);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  .footer-pips {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .pip-button {
    width: 24px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .pip-line {
    width: 14px;
    height: 4px;
    border-radius: 2px;
    background: rgba(148, 163, 184, 0.25);
    transition: all 0.25s ease;
  }

  .pip-button.active .pip-line {
    width: 28px;
    background: linear-gradient(90deg, #a855f7, #6366f1);
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.65);
  }

  .pip-button:hover:not(.active) .pip-line {
    background: rgba(168, 85, 247, 0.5);
  }

  /* -------------------------------------------------------------
     10. RESPONSIVE BREAKPOINT (< 768px)
     ------------------------------------------------------------- */
  @media (max-width: 768px) {
    .nox-book-section {
      padding: 1.2rem 0.85rem 1.2rem;
    }

    .book-ambient-glow {
      width: 95%;
      height: 75%;
      filter: blur(28px);
    }

    .book-nav-btn {
      display: none; /* Mobile uses swipe gestures & bottom pips */
    }

    .desktop-stage {
      display: none !important;
    }

    .mobile-stage {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .book-footer {
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;
      margin-top: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .leaf-forward,
    .leaf-backward,
    .mobile-card,
    .sweep-front,
    .sweep-back,
    .cast-under-shadow {
      animation: none !important;
      transform: none !important;
    }
  }
</style>
