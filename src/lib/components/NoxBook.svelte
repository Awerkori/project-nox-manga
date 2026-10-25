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

  // Active indices
  let currentIndex = $state(0);
  let nextIndex = $state(0);
  let isFlipping = $state(false);
  let flipDirection = $state<'forward' | 'backward'>('forward');
  let isPaused = $state(false);
  let prefersReducedMotion = $state(false);

  // Timing configuration
  const READING_TIME_MS = 3000; // 3.0s display per work
  const FLIP_DURATION_MS = 750; // 750ms smooth realistic page turn

  let timerStartTime = 0;
  let remainingTime = READING_TIME_MS;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let animProgress = $state(0); // 0.0 to 1.0 for progress dot

  // Active, Next & Prev works
  let currentWork = $derived(works.length > 0 ? works[currentIndex % works.length] : null);
  let targetWork = $derived(works.length > 0 ? works[nextIndex % works.length] : null);
  let prevIndexCalc = $derived((currentIndex - 1 + works.length) % works.length);
  let nextIndexCalc = $derived((currentIndex + 1) % works.length);

  // Touch tracking for mobile swipe
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;
  let touchDeltaY = 0;

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

  // Timer controls
  function startReadingTimer(duration = READING_TIME_MS) {
    clearReadingTimer();
    if (works.length <= 1 || isPaused || document.hidden) return;

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
      remainingTime = Math.max(200, remainingTime - elapsed);
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

    // Dispatch custom event to notify ParticleBackground for subtle cosmic resonance
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

  // Keyboard navigation
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      flipPage('forward', true);
    } else if (e.key === 'ArrowLeft') {
      flipPage('backward', true);
    }
  }

  // Touch gestures for mobile swipe
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
      Math.abs(touchDeltaX) > 45 && Math.abs(touchDeltaX) > Math.abs(touchDeltaY) * 1.3;

    if (isHorizontalSwipe) {
      if (touchDeltaX < 0) {
        // Swiped left -> advance to next work
        flipPage('forward', true);
      } else {
        // Swiped right -> return to previous work
        flipPage('backward', true);
      }
    }
    resumeReadingTimer();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      clearReadingTimer();
    } else if (!isPaused && !isFlipping) {
      startReadingTimer(remainingTime);
    }
  }

  // Strict CSP Action Helpers (avoids inline event handlers in SSR HTML)
  function bindBookEvents(node: HTMLElement) {
    node.addEventListener('mouseenter', pauseReadingTimer);
    node.addEventListener('mouseleave', resumeReadingTimer);
    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: true });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });

    return {
      destroy() {
        node.removeEventListener('mouseenter', pauseReadingTimer);
        node.removeEventListener('mouseleave', resumeReadingTimer);
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
  aria-label="Nox Book — Vitrine Interativa de Obras 3D"
  use:bindBookEvents
>
  <!-- Ambient Cosmic Glow behind Book -->
  <div class="book-ambient-glow" aria-hidden="true"></div>

  <!-- Outer Navigation Arrows -->
  <button
    class="book-nav-btn prev-btn"
    use:bindClick={() => flipPage('backward', true)}
    disabled={isFlipping}
    aria-label="Obra anterior do livro"
  >
    <ChevronLeft size={22} />
  </button>

  <button
    class="book-nav-btn next-btn"
    use:bindClick={() => flipPage('forward', true)}
    disabled={isFlipping}
    aria-label="Próxima obra do livro"
  >
    <ChevronRight size={22} />
  </button>

  <!-- 3D BOOK STAGE -->
  <div class="nox-book-stage">
    <div class="nox-book" class:flipping={isFlipping}>
      <!-- Hardcover Backing Frame & Stacked Page Edges -->
      <div class="book-cover-frame" aria-hidden="true">
        <div class="page-stack page-stack-left"></div>
        <div class="page-stack page-stack-right"></div>
        <div class="spine-hinge">
          <div class="spine-thread"></div>
          <div class="spine-charm">
            <Sparkles size={11} class="charm-icon" />
          </div>
        </div>
      </div>

      <!-- DESKTOP SPREAD (Visible >= 768px) -->
      <div class="book-spread desktop-only">
        <!-- STATIC LEFT PAGE (Underneath / Base) -->
        <div class="book-page left-page static-left">
          {#if isFlipping && flipDirection === 'backward' && targetWork}
            <!-- Revealing target work on backward flip -->
            {@render pageArtwork(targetWork)}
          {:else if currentWork}
            <!-- Showing current work artwork -->
            {@render pageArtwork(currentWork)}
          {/if}
          <div class="crease-shadow crease-shadow-left"></div>
        </div>

        <!-- STATIC RIGHT PAGE (Underneath / Base) -->
        <div class="book-page right-page static-right">
          {#if isFlipping && flipDirection === 'forward' && targetWork}
            <!-- Revealing target work on forward flip -->
            {@render pageChronicle(targetWork)}
          {:else if currentWork}
            <!-- Showing current work chronicle -->
            {@render pageChronicle(currentWork)}
          {/if}
          <div class="crease-shadow crease-shadow-right"></div>
          {#if isFlipping && flipDirection === 'forward'}
            <div class="under-leaf-cast-shadow forward"></div>
          {/if}
        </div>

        <!-- THE 3D TURNING LEAF (Active when flipping) -->
        {#if isFlipping}
          {#if flipDirection === 'forward'}
            <!-- Forward turning leaf: turns from right to left (0deg to -180deg) -->
            <div class="flipper-leaf forward-flipper">
              <!-- Front Face: Current Work Chronicle (turns away) -->
              <div class="leaf-face front-face">
                {#if currentWork}
                  {@render pageChronicle(currentWork)}
                {/if}
                <div class="dynamic-curl-shadow front"></div>
              </div>

              <!-- Back Face: Next Work Artwork (lands on left) -->
              <div class="leaf-face back-face">
                {#if targetWork}
                  {@render pageArtwork(targetWork)}
                {/if}
                <div class="dynamic-curl-shadow back"></div>
              </div>
            </div>
          {:else}
            <!-- Backward turning leaf: turns from left to right (0deg to 180deg) -->
            <div class="flipper-leaf backward-flipper">
              <!-- Front Face: Current Work Artwork (turns away) -->
              <div class="leaf-face front-face">
                {#if currentWork}
                  {@render pageArtwork(currentWork)}
                {/if}
                <div class="dynamic-curl-shadow front"></div>
              </div>

              <!-- Back Face: Target Work Chronicle (lands on right) -->
              <div class="leaf-face back-face">
                {#if targetWork}
                  {@render pageChronicle(targetWork)}
                {/if}
                <div class="dynamic-curl-shadow back"></div>
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- MOBILE FOLIO (Visible < 768px) -->
      <div class="book-folio mobile-only">
        <div
          class="mobile-folio-card"
          class:mobile-flipping-forward={isFlipping && flipDirection === 'forward'}
          class:mobile-flipping-backward={isFlipping && flipDirection === 'backward'}
        >
          {#if currentWork}
            <!-- Upper Section: Cover Artwork with luminous frame -->
            <div class="mobile-art-wrapper">
              {@render pageArtwork(currentWork, true)}
            </div>

            <!-- Lower Section: Essential Info & Action CTA -->
            <div class="mobile-chronicle-wrapper">
              {@render pageChronicle(currentWork, true)}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- BOOK FOOTER CONTROLS & FOLIO PAGINATION -->
  <div class="book-footer">
    <div class="book-folio-index">
      <Compass size={13} class="folio-compass-icon" />
      <span class="folio-text">
        Folha <strong class="current-folio">{String(currentIndex + 1).padStart(2, '0')}</strong> de {works.length}
      </span>
      <span class="auto-advance-indicator" class:paused={isPaused} title={isPaused ? 'Pausado ao interagir' : 'Virada automática a cada 3s'}>
        <span class="pulse-dot"></span>
        <span class="indicator-label">{isPaused ? 'Pausado' : 'Folheando'}</span>
      </span>
    </div>

    <!-- Quick Indicator Pips -->
    <div class="folio-pips" role="tablist" aria-label="Navegar entre as 10 obras do livro">
      {#each works as w, idx}
        <button
          class="pip-btn"
          class:active={idx === currentIndex}
          use:bindClick={() => goToWork(idx)}
          aria-label="Ir para obra {idx + 1}: {w.title}"
          role="tab"
          aria-selected={idx === currentIndex}
        >
          <span class="pip-inner"></span>
        </button>
      {/each}
    </div>
  </div>
</section>

<!-- SNIPPET: Page Artwork (Left Page on Desktop / Top on Mobile) -->
{#snippet pageArtwork(work: Work, isMobile = false)}
  <div class="artwork-canvas" class:is-mobile={isMobile}>
    <div class="art-frame">
      <div class="art-inner-glow"></div>
      <img
        src={getCover(work, 'hero')}
        alt={work.title}
        class="work-cover-img"
        class:nsfw-blur={getIsAdult(work) && (page.data?.blurNsfw ?? true)}
        use:fallbackCover
        loading="eager"
        decoding="async"
      />

      <!-- Gilded Grimoire Corner Details -->
      <div class="grimoire-corner corner-tl"></div>
      <div class="grimoire-corner corner-tr"></div>
      <div class="grimoire-corner corner-bl"></div>
      <div class="grimoire-corner corner-br"></div>

      <!-- Badges on Cover -->
      <div class="cover-badges-overlay">
        {#if work.kind}
          <span class="badge badge-kind">
            {kindLabels[work.kind] || work.kind}
          </span>
        {/if}

        {#if getIsAdult(work)}
          <span class="badge badge-adult">
            <AlertTriangle size={11} />
            <span>+18</span>
          </span>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

<!-- SNIPPET: Page Chronicle / Info (Right Page on Desktop / Bottom on Mobile) -->
{#snippet pageChronicle(work: Work, isMobile = false)}
  {@const continueItem = getContinueItem(work)}
  <div class="chronicle-canvas" class:is-mobile={isMobile}>
    <!-- Book Header Ribbon -->
    <div class="chronicle-header">
      <span class="grimoire-tag">
        <Sparkles size={12} class="sparkle-icon" />
        <span>Projeto Nox • Vitrine de Obras</span>
      </span>
      <span class="work-views-stat">
        <Eye size={12} />
        <span>{formatViews(work.views)} leituras</span>
      </span>
    </div>

    <!-- Title -->
    <h1 class="chronicle-title">
      <a href="/obra/{work.slug}" title={work.title}>
        {work.title}
      </a>
    </h1>

    <!-- Meta Tags / Attributes -->
    <div class="chronicle-meta">
      {#if work.status}
        <span class="meta-pill status-pill">
          {work.status === 'COMPLETED' ? 'Concluído' : 'Em Lançamento'}
        </span>
      {/if}
      {#if (work as any).total_chapters || (work as any).chapters_count}
        <span class="meta-pill">
          {(work as any).total_chapters || (work as any).chapters_count} Capítulos
        </span>
      {/if}
    </div>

    <!-- Synopsis -->
    <div class="chronicle-synopsis-box">
      <p class="chronicle-synopsis">
        {#if work.synopsis}
          {decodeHtmlEntities(work.synopsis)}
        {:else}
          Acompanhe esta fascinante jornada digital no Project Nox com leitura contínua e imersão total.
        {/if}
      </p>
    </div>

    <!-- Continue reading notice if authenticated user stopped here -->
    {#if continueItem}
      <div class="continue-reading-ribbon">
        <BookOpen size={13} class="continue-icon" />
        <span>Você tem leitura em andamento nesta obra</span>
      </div>
    {/if}

    <!-- Call to Action Buttons -->
    <div class="chronicle-actions">
      <a
        href={continueItem ? continueItem.destinationUrl : `/obra/${work.slug}`}
        class="action-btn btn-primary"
      >
        <BookOpen size={16} />
        <span>{continueItem ? 'Continuar Leitura' : 'Ler Agora'}</span>
      </a>

      <a href="/obra/{work.slug}" class="action-btn btn-secondary">
        <span>Ver Detalhes</span>
        <ArrowRight size={14} />
      </a>
    </div>
  </div>
{/snippet}

<style>
  /* -------------------------------------------------------------
     1. NOX BOOK SECTION & CONTAINER
     ------------------------------------------------------------- */
  .nox-book-section {
    position: relative;
    width: 100%;
    max-width: 1240px;
    margin: 0 auto;
    padding: 2.2rem 1.5rem 1.8rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    user-select: none;
    z-index: 10;
  }

  /* Atmospheric Cosmic Backing Behind the Book */
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
     2. NAVIGATION ARROWS
     ------------------------------------------------------------- */
  .book-nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(15, 14, 25, 0.82);
    border: 1px solid rgba(139, 92, 246, 0.28);
    color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 30;
    transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(8px);
  }

  .book-nav-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.24);
    border-color: rgba(168, 85, 247, 0.65);
    color: #ffffff;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.45);
    transform: translateY(-50%) scale(1.08);
  }

  .book-nav-btn:active:not(:disabled) {
    transform: translateY(-50%) scale(0.96);
  }

  .book-nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .prev-btn {
    left: 0.25rem;
  }

  .next-btn {
    right: 0.25rem;
  }

  /* -------------------------------------------------------------
     3. 3D BOOK STAGE & HARDCOVER FRAME
     ------------------------------------------------------------- */
  .nox-book-stage {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    perspective: 2400px;
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

  /* Hardcover Binding, Stacked Pages & Spine */
  .book-cover-frame {
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

  /* Stacked Page Edges (giving the illusion of 200+ physical pages) */
  .page-stack {
    position: absolute;
    top: 10px;
    bottom: 10px;
    width: 10px;
    background: repeating-linear-gradient(
      to bottom,
      #131122 0px,
      #131122 1px,
      #242038 1px,
      #242038 2px
    );
    opacity: 0.75;
  }

  .page-stack-left {
    left: -4px;
    border-radius: 4px 0 0 4px;
    box-shadow: inset 1px 0 2px rgba(0, 0, 0, 0.75);
  }

  .page-stack-right {
    right: -4px;
    border-radius: 0 4px 4px 0;
    box-shadow: inset -1px 0 2px rgba(0, 0, 0, 0.75);
  }

  /* Center Spine Hinge & Bookmark */
  .spine-hinge {
    position: absolute;
    top: -2px;
    bottom: -2px;
    left: calc(50% - 14px);
    width: 28px;
    background: linear-gradient(
      to right,
      rgba(7, 6, 14, 0.95) 0%,
      rgba(24, 18, 42, 0.98) 45%,
      rgba(40, 28, 70, 0.98) 50%,
      rgba(24, 18, 42, 0.98) 55%,
      rgba(7, 6, 14, 0.95) 100%
    );
    border-left: 1px solid rgba(0, 0, 0, 0.85);
    border-right: 1px solid rgba(0, 0, 0, 0.85);
    z-index: 15;
    box-shadow:
      inset 0 0 6px rgba(0, 0, 0, 0.9),
      0 0 10px rgba(124, 58, 237, 0.12);
  }

  .spine-thread {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    background: linear-gradient(
      to bottom,
      #a855f7 0%,
      #6366f1 50%,
      #7c3aed 100%
    );
    opacity: 0.85;
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
  }

  .spine-charm {
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #110e20;
    border: 1px solid rgba(168, 85, 247, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.55);
  }

  :global(.charm-icon) {
    color: #c084fc;
  }

  /* -------------------------------------------------------------
     4. DESKTOP BOOK SPREAD (TWO CONNECTED PAGES)
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
    background: #0f0d1a;
    overflow: hidden;
    box-sizing: border-box;
  }

  .left-page {
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    background: linear-gradient(to right, #0e0c19 0%, #121022 92%, #0a0814 100%);
    box-shadow: inset -8px 0 16px -6px rgba(0, 0, 0, 0.85);
  }

  .right-page {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
    background: linear-gradient(to left, #0e0c19 0%, #131024 92%, #0a0814 100%);
    box-shadow: inset 8px 0 16px -6px rgba(0, 0, 0, 0.85);
  }

  /* Center Crease Shadows */
  .crease-shadow {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 38px;
    pointer-events: none;
    z-index: 8;
  }

  .crease-shadow-left {
    right: 0;
    background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.75));
  }

  .crease-shadow-right {
    left: 0;
    background: linear-gradient(to left, transparent, rgba(0, 0, 0, 0.75));
  }

  /* Under-leaf cast shadow (cast on static right page as leaf lifts) */
  .under-leaf-cast-shadow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 7;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.75) 0%, transparent 45%);
    animation: castShadowFade 750ms ease-out forwards;
  }

  @keyframes castShadowFade {
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
     5. 3D TURNING LEAF (FORWARD & BACKWARD FLIP)
     ------------------------------------------------------------- */
  .flipper-leaf {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    height: 100%;
    transform-style: preserve-3d;
    z-index: 20;
    pointer-events: none;
  }

  .forward-flipper {
    left: 50%;
    transform-origin: left center;
    animation: flipForwardCurl 750ms cubic-bezier(0.25, 0.92, 0.35, 1) forwards;
  }

  .backward-flipper {
    left: 0;
    transform-origin: right center;
    animation: flipBackwardCurl 750ms cubic-bezier(0.25, 0.92, 0.35, 1) forwards;
  }

  /* Realistic Curvature & Physics Keyframes */
  @keyframes flipForwardCurl {
    0% {
      transform: rotateY(0deg) skewY(0deg) translateZ(0px);
    }
    30% {
      transform: rotateY(-50deg) skewY(-1.8deg) translateZ(28px);
    }
    55% {
      transform: rotateY(-95deg) skewY(0deg) translateZ(38px);
    }
    80% {
      transform: rotateY(-145deg) skewY(1.8deg) translateZ(18px);
    }
    100% {
      transform: rotateY(-180deg) skewY(0deg) translateZ(0px);
    }
  }

  @keyframes flipBackwardCurl {
    0% {
      transform: rotateY(0deg) skewY(0deg) translateZ(0px);
    }
    30% {
      transform: rotateY(50deg) skewY(1.8deg) translateZ(28px);
    }
    55% {
      transform: rotateY(95deg) skewY(0deg) translateZ(38px);
    }
    80% {
      transform: rotateY(145deg) skewY(-1.8deg) translateZ(18px);
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
    background: #0f0d1a;
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

  /* Dynamic Moving Shadow Overlays on the Turning Leaf */
  .dynamic-curl-shadow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .dynamic-curl-shadow.front {
    animation: frontShadowSweep 750ms ease-out forwards;
  }

  .dynamic-curl-shadow.back {
    animation: backShadowSweep 750ms ease-out forwards;
  }

  @keyframes frontShadowSweep {
    0% {
      background: linear-gradient(to right, rgba(0, 0, 0, 0.4), transparent 60%);
      opacity: 0.2;
    }
    45% {
      background: linear-gradient(
        to right,
        rgba(0, 0, 0, 0.75) 0%,
        rgba(255, 255, 255, 0.12) 40%,
        rgba(0, 0, 0, 0.85) 100%
      );
      opacity: 0.85;
    }
    100% {
      background: linear-gradient(to right, rgba(0, 0, 0, 0.95), transparent);
      opacity: 1;
    }
  }

  @keyframes backShadowSweep {
    0% {
      background: linear-gradient(to left, rgba(0, 0, 0, 0.95), transparent);
      opacity: 1;
    }
    55% {
      background: linear-gradient(
        to left,
        rgba(0, 0, 0, 0.75) 0%,
        rgba(255, 255, 255, 0.12) 40%,
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
     6. LEFT PAGE CONTENT: ARTWORK CANVAS
     ------------------------------------------------------------- */
  .artwork-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 2.2rem 2.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .art-frame {
    position: relative;
    width: 250px;
    height: 380px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow:
      0 18px 42px -10px rgba(0, 0, 0, 0.88),
      0 0 30px rgba(139, 92, 246, 0.18),
      0 0 0 1px rgba(139, 92, 246, 0.3);
    background: #080710;
  }

  .work-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
    transition: transform 0.4s ease;
  }

  .work-cover-img.nsfw-blur {
    filter: blur(14px);
  }

  .art-inner-glow {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.55);
    pointer-events: none;
    z-index: 2;
  }

  /* Grimoire Gilded Corner Details */
  .grimoire-corner {
    position: absolute;
    width: 18px;
    height: 18px;
    pointer-events: none;
    z-index: 4;
    border: 2px solid rgba(168, 85, 247, 0.6);
  }

  .corner-tl {
    top: 6px;
    left: 6px;
    border-right: none;
    border-bottom: none;
  }

  .corner-tr {
    top: 6px;
    right: 6px;
    border-left: none;
    border-bottom: none;
  }

  .corner-bl {
    bottom: 6px;
    left: 6px;
    border-right: none;
    border-top: none;
  }

  .corner-br {
    bottom: 6px;
    right: 6px;
    border-left: none;
    border-top: none;
  }

  .cover-badges-overlay {
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

  .badge {
    padding: 0.28rem 0.6rem;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(6px);
  }

  .badge-kind {
    background: rgba(139, 92, 246, 0.88);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .badge-adult {
    background: rgba(225, 29, 72, 0.9);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* -------------------------------------------------------------
     7. RIGHT PAGE CONTENT: CHRONICLE / INFO
     ------------------------------------------------------------- */
  .chronicle-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 2.6rem 2.8rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-sizing: border-box;
    color: #f1f5f9;
  }

  .chronicle-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.9rem;
  }

  .grimoire-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c084fc;
  }

  :global(.sparkle-icon) {
    color: #a855f7;
  }

  .work-views-stat {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .chronicle-title {
    margin: 0 0 0.8rem 0;
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1.22;
    letter-spacing: -0.02em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .chronicle-title a {
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .chronicle-title a:hover {
    color: #c084fc;
  }

  .chronicle-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-bottom: 1.1rem;
  }

  .meta-pill {
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

  .chronicle-synopsis-box {
    margin-bottom: 1.4rem;
    max-height: 110px;
    overflow: hidden;
  }

  .chronicle-synopsis {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.55;
    color: #94a3b8;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .continue-reading-ribbon {
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

  :global(.continue-icon) {
    color: #60a5fa;
  }

  .chronicle-actions {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .action-btn {
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

  .btn-primary {
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    box-shadow: 0 4px 18px rgba(124, 58, 237, 0.38);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn-primary:hover {
    background: linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%);
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.55);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: rgba(22, 19, 36, 0.8);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #e2e8f0;
  }

  .btn-secondary:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(168, 85, 247, 0.6);
    color: #ffffff;
  }

  /* -------------------------------------------------------------
     8. BOOK FOOTER & FOLIO PAGINATION
     ------------------------------------------------------------- */
  .book-footer {
    width: 100%;
    max-width: 1060px;
    margin-top: 1.2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.5rem;
    box-sizing: border-box;
  }

  .book-folio-index {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.82rem;
    color: #94a3b8;
  }

  :global(.folio-compass-icon) {
    color: #a855f7;
  }

  .current-folio {
    color: #e2e8f0;
    font-weight: 700;
  }

  .auto-advance-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: 0.8rem;
    padding: 0.18rem 0.5rem;
    border-radius: 9999px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    font-size: 0.7rem;
    color: #c084fc;
    transition: all 0.2s ease;
  }

  .auto-advance-indicator.paused {
    background: rgba(234, 179, 8, 0.12);
    border-color: rgba(234, 179, 8, 0.3);
    color: #facc15;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #a855f7;
    animation: dotPulse 1.8s infinite;
  }

  .auto-advance-indicator.paused .pulse-dot {
    background: #eab308;
    animation: none;
  }

  @keyframes dotPulse {
    0%, 100% {
      opacity: 0.4;
      transform: scale(0.9);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  .folio-pips {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .pip-btn {
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

  .pip-inner {
    width: 14px;
    height: 4px;
    border-radius: 2px;
    background: rgba(148, 163, 184, 0.25);
    transition: all 0.25s ease;
  }

  .pip-btn.active .pip-inner {
    width: 28px;
    background: linear-gradient(90deg, #a855f7, #6366f1);
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.65);
  }

  .pip-btn:hover:not(.active) .pip-inner {
    background: rgba(168, 85, 247, 0.5);
  }

  /* -------------------------------------------------------------
     9. MOBILE RESPONSIVE FOLIO (< 768px)
     ------------------------------------------------------------- */
  .desktop-only {
    display: flex;
  }

  .mobile-only {
    display: none;
  }

  @media (max-width: 768px) {
    .nox-book-section {
      padding: 1.2rem 0.75rem 1.2rem;
    }

    .book-ambient-glow {
      width: 95%;
      height: 80%;
      filter: blur(28px);
    }

    .book-nav-btn {
      display: none; /* Mobile uses swipe gestures & pip buttons */
    }

    .desktop-only {
      display: none;
    }

    .mobile-only {
      display: block;
      width: 100%;
      height: 100%;
    }

    .nox-book {
      height: auto;
      min-height: 570px;
      max-width: 440px;
    }

    .spine-hinge,
    .page-stack {
      display: none;
    }

    .book-folio-card {
      position: relative;
      width: 100%;
      background: #0f0d1a;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow:
        0 14px 35px -8px rgba(0, 0, 0, 0.9),
        0 0 25px rgba(124, 58, 237, 0.12);
      border: 1px solid rgba(139, 92, 246, 0.26);
      transform-origin: left center;
    }

    /* Mobile 3D Page Flip Keyframes */
    .mobile-folio-card.mobile-flipping-forward {
      animation: mobileFlipForward 700ms cubic-bezier(0.25, 0.9, 0.3, 1) forwards;
    }

    .mobile-folio-card.mobile-flipping-backward {
      animation: mobileFlipBackward 700ms cubic-bezier(0.25, 0.9, 0.3, 1) forwards;
    }

    @keyframes mobileFlipForward {
      0% {
        transform: rotateY(0deg) scale(1);
        opacity: 1;
      }
      45% {
        transform: rotateY(-70deg) scale(0.96);
        opacity: 0.6;
      }
      100% {
        transform: rotateY(0deg) scale(1);
        opacity: 1;
      }
    }

    @keyframes mobileFlipBackward {
      0% {
        transform: rotateY(0deg) scale(1);
        opacity: 1;
      }
      45% {
        transform: rotateY(70deg) scale(0.96);
        opacity: 0.6;
      }
      100% {
        transform: rotateY(0deg) scale(1);
        opacity: 1;
      }
    }

    .mobile-art-wrapper {
      width: 100%;
      height: 290px;
      position: relative;
    }

    .artwork-canvas.is-mobile {
      padding: 1.2rem;
    }

    .artwork-canvas.is-mobile .art-frame {
      width: 175px;
      height: 255px;
    }

    .mobile-chronicle-wrapper {
      width: 100%;
      padding: 0 1.25rem 1.4rem;
      box-sizing: border-box;
    }

    .chronicle-canvas.is-mobile {
      padding: 0;
    }

    .chronicle-canvas.is-mobile .chronicle-title {
      font-size: 1.35rem;
      margin-bottom: 0.5rem;
    }

    .chronicle-canvas.is-mobile .chronicle-synopsis-box {
      max-height: 70px;
      margin-bottom: 1rem;
    }

    .chronicle-canvas.is-mobile .chronicle-synopsis {
      font-size: 0.8rem;
      -webkit-line-clamp: 3;
    }

    .chronicle-canvas.is-mobile .action-btn {
      width: 100%;
      padding: 0.65rem 1rem;
    }

    .chronicle-canvas.is-mobile .chronicle-actions {
      flex-direction: column;
      gap: 0.5rem;
    }

    .book-footer {
      flex-direction: column;
      gap: 0.75rem;
      align-items: center;
      margin-top: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .forward-flipper,
    .backward-flipper,
    .mobile-folio-card.mobile-flipping-forward,
    .mobile-folio-card.mobile-flipping-backward,
    .dynamic-curl-shadow.front,
    .dynamic-curl-shadow.back,
    .under-leaf-cast-shadow {
      animation: none !important;
      transform: none !important;
    }
  }
</style>
