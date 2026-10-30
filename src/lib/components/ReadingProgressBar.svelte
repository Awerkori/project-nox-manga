<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ProgressPosition, ProgressDisplay, ReadingMode } from '$lib/reader-settings';

  let {
    mode = 'webtoon',
    currentPage = 1,
    totalPages = 1,
    position = 'off',
    display = 'percent',
    uiVisible = true,
    onPageJump = () => {}
  }: {
    mode?: ReadingMode;
    currentPage?: number;
    totalPages?: number;
    position?: ProgressPosition;
    display?: ProgressDisplay;
    uiVisible?: boolean;
    onPageJump?: (page: number) => void;
  } = $props();

  let scrollPercent = $state(0);
  let isDragging = $state(false);
  let isHovered = $state(false);
  let isPastPages = $state(false);
  let showTemporaryPill = $state(false);
  let hidePillTimeout: any = null;
  let rafId: number | null = null;
  let railElement: HTMLElement | undefined = $state();

  function triggerTemporaryPill() {
    showTemporaryPill = true;
    if (hidePillTimeout) clearTimeout(hidePillTimeout);
    hidePillTimeout = setTimeout(() => {
      showTemporaryPill = false;
    }, 1200);
  }

  function getChapterScrollBounds() {
    if (typeof window === 'undefined') return { stackTop: 56, maxScroll: 1 };
    const stack = document.querySelector('.webtoon-stack') as HTMLElement | null;
    if (stack) {
      const rect = stack.getBoundingClientRect();
      const stackTop = rect.top + window.scrollY;
      const stackHeight = stack.offsetHeight;
      const maxScroll = Math.max(1, stackHeight - window.innerHeight);
      return { stackTop, maxScroll };
    }
    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
    const maxScroll = Math.max(1, scrollHeight - window.innerHeight);
    return { stackTop: 0, maxScroll };
  }

  function calculateProgress() {
    if (typeof window === 'undefined' || position === 'off' || isDragging) return;

    // Check if user has scrolled past reading pages into chapter-end / comments
    const endSection = document.getElementById('chapter-end');
    if (endSection) {
      const endRect = endSection.getBoundingClientRect();
      isPastPages = endRect.top < window.innerHeight;
    } else {
      const stack = document.querySelector('.webtoon-stack') as HTMLElement | null;
      if (stack) {
        const stackRect = stack.getBoundingClientRect();
        isPastPages = stackRect.bottom < window.innerHeight;
      } else {
        isPastPages = false;
      }
    }

    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
      return;
    }

    const { stackTop, maxScroll } = getChapterScrollBounds();
    const currentScroll = (window.scrollY || document.documentElement.scrollTop || 0) - stackTop;
    scrollPercent = Math.min(100, Math.max(0, Math.round((currentScroll / maxScroll) * 100)));
  }

  function handleScroll() {
    if (rafId || position === 'off' || isDragging) return;
    rafId = requestAnimationFrame(() => {
      calculateProgress();
      rafId = null;
    });
  }

  function seekToEvent(e: PointerEvent, rail: HTMLElement, instant: boolean) {
    const rect = rail.getBoundingClientRect();
    let ratio = 0;
    if (position === 'left' || position === 'right') {
      ratio = (e.clientY - rect.top) / rect.height;
    } else {
      ratio = (e.clientX - rect.left) / rect.width;
    }
    ratio = Math.max(0, Math.min(1, ratio));
    scrollPercent = Math.round(ratio * 100);

    if (mode === 'paginated') {
      const targetPage = Math.max(1, Math.min(totalPages, Math.round(ratio * (totalPages - 1)) + 1));
      onPageJump(targetPage);
    } else {
      const { stackTop, maxScroll } = getChapterScrollBounds();
      const targetScroll = stackTop + ratio * maxScroll;
      window.scrollTo({
        top: targetScroll,
        behavior: instant ? 'instant' : 'smooth'
      });
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (position === 'off' || e.button !== 0) return;
    const rail = e.currentTarget as HTMLElement;
    rail.setPointerCapture(e.pointerId);
    isDragging = true;
    triggerTemporaryPill();
    seekToEvent(e, rail, true);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    e.preventDefault();
    const rail = e.currentTarget as HTMLElement;
    seekToEvent(e, rail, true);
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    triggerTemporaryPill();
  }

  function handlePointerCancel(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    triggerTemporaryPill();
  }

  $effect(() => {
    if (position === 'off') return;
    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
    } else if (!isDragging) {
      calculateProgress();
    }
  });

  onMount(() => {
    if (position !== 'off') {
      calculateProgress();
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll, { passive: true });
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    }
    if (rafId) cancelAnimationFrame(rafId);
    if (hidePillTimeout) clearTimeout(hidePillTimeout);
  });
</script>

{#if position !== 'off'}
  <!-- NOX MINIMALIST & TACTILE PROGRESS BAR WITH DRAG-TO-SEEK -->
  <aside
    class="nox-progress-system pos-{position}"
    class:is-active-dragging={isDragging}
    class:is-hovered={isHovered}
    class:is-past-pages={isPastPages}
    role="region"
    aria-label="Progresso de leitura e navegação"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  >
    <!-- Interactive Touch Track with Pointer Events -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      bind:this={railElement}
      class="nox-progress-rail"
      role="slider"
      tabindex="0"
      aria-valuenow={scrollPercent}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Navegar pelo capítulo"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerCancel}
    >
      <!-- Visible Track Bed -->
      <div class="rail-bed"></div>

      <!-- Fluid Nox Purple Fill -->
      <div
        class="rail-fill"
        style={position === 'left' || position === 'right'
          ? `height: ${scrollPercent}%;`
          : `width: ${scrollPercent}%;`}
      >
        <!-- Sleek Drag Handle Bead -->
        <span class="rail-bead" class:bead-active={isDragging || isHovered}></span>
      </div>
    </div>

    <!-- Discreet Percentage Pill: Hidden during normal reading, shown only on active drag or hover -->
    {#if display !== 'none'}
      <div
        class="nox-progress-pill"
        class:pill-visible={isDragging || isHovered || showTemporaryPill}
        aria-live="polite"
      >
        {#if display === 'percent'}
          <span class="pill-value">{scrollPercent}%</span>
        {:else if display === 'pages'}
          <span class="pill-value">{currentPage} / {totalPages}</span>
        {:else}
          <span class="pill-value">{currentPage}/{totalPages} · {scrollPercent}%</span>
        {/if}
      </div>
    {/if}
  </aside>
{/if}

<style>
  .nox-progress-system {
    position: fixed;
    z-index: 60;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
  }

  .nox-progress-system.is-past-pages {
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .nox-progress-system.pos-bottom.is-past-pages {
    transform: translateX(-50%) translateY(24px) !important;
  }

  .nox-progress-system.pos-left.is-past-pages {
    transform: translateY(-50%) translateX(-24px) !important;
  }

  .nox-progress-system.pos-right.is-past-pages {
    transform: translateY(-50%) translateX(24px) !important;
  }

  /* --------------------------------------------------------------------------
     1. POSITION: BOTTOM
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-bottom {
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
    width: min(calc(100vw - 36px), 760px);
    height: 24px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .nox-progress-system.pos-bottom .nox-progress-rail {
    position: relative;
    width: 100%;
    height: 24px;
    display: flex;
    align-items: center;
    cursor: pointer;
    touch-action: none;
  }

  .nox-progress-system.pos-bottom .rail-bed {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: height 0.15s ease, background-color 0.15s ease;
  }

  .nox-progress-system.pos-bottom:hover .rail-bed,
  .nox-progress-system.pos-bottom.is-active-dragging .rail-bed {
    height: 5px;
    background: rgba(255, 255, 255, 0.2);
  }

  .nox-progress-system.pos-bottom .rail-fill {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    height: 4px;
    background: linear-gradient(90deg, #9333ea 0%, #a855f7 100%);
    border-radius: 9999px;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    transition: height 0.15s ease;
  }

  .nox-progress-system.pos-bottom:hover .rail-fill,
  .nox-progress-system.pos-bottom.is-active-dragging .rail-fill {
    height: 5px;
  }

  .nox-progress-system.pos-bottom .rail-bead {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 6px #a855f7, 0 0 10px rgba(168, 85, 247, 0.7);
    margin-right: -4px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .nox-progress-system.pos-bottom .rail-bead.bead-active {
    transform: scale(1.35);
  }

  .nox-progress-system.pos-bottom .nox-progress-pill {
    position: absolute;
    bottom: 26px;
    left: 50%;
    transform: translateX(-50%) translateY(4px);
  }

  /* --------------------------------------------------------------------------
     2. POSITION: LEFT
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-left {
    top: 50%;
    left: calc(env(safe-area-inset-left, 0px) + 6px);
    transform: translateY(-50%);
    width: 26px;
    height: min(50vh, 300px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nox-progress-system.pos-left .nox-progress-rail {
    position: relative;
    width: 26px;
    height: 100%;
    display: flex;
    justify-content: center;
    cursor: pointer;
    touch-action: none;
  }

  .nox-progress-system.pos-left .rail-bed {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: width 0.15s ease, background-color 0.15s ease;
  }

  .nox-progress-system.pos-left:hover .rail-bed,
  .nox-progress-system.pos-left.is-active-dragging .rail-bed {
    width: 5px;
    background: rgba(255, 255, 255, 0.2);
  }

  .nox-progress-system.pos-left .rail-fill {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    background: linear-gradient(180deg, #9333ea 0%, #a855f7 100%);
    border-radius: 9999px;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    transition: width 0.15s ease;
  }

  .nox-progress-system.pos-left:hover .rail-fill,
  .nox-progress-system.pos-left.is-active-dragging .rail-fill {
    width: 5px;
  }

  .nox-progress-system.pos-left .rail-bead {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 6px #a855f7, 0 0 10px rgba(168, 85, 247, 0.7);
    margin-bottom: -4px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .nox-progress-system.pos-left .rail-bead.bead-active {
    transform: scale(1.35);
  }

  .nox-progress-system.pos-left .nox-progress-pill {
    position: absolute;
    left: 30px;
    top: 50%;
    transform: translateY(-50%) translateX(-4px);
  }

  /* --------------------------------------------------------------------------
     3. POSITION: RIGHT
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-right {
    top: 50%;
    right: calc(env(safe-area-inset-right, 0px) + 6px);
    transform: translateY(-50%);
    width: 26px;
    height: min(50vh, 300px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nox-progress-system.pos-right .nox-progress-rail {
    position: relative;
    width: 26px;
    height: 100%;
    display: flex;
    justify-content: center;
    cursor: pointer;
    touch-action: none;
  }

  .nox-progress-system.pos-right .rail-bed {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: width 0.15s ease, background-color 0.15s ease;
  }

  .nox-progress-system.pos-right:hover .rail-bed,
  .nox-progress-system.pos-right.is-active-dragging .rail-bed {
    width: 5px;
    background: rgba(255, 255, 255, 0.2);
  }

  .nox-progress-system.pos-right .rail-fill {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    background: linear-gradient(180deg, #9333ea 0%, #a855f7 100%);
    border-radius: 9999px;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    transition: width 0.15s ease;
  }

  .nox-progress-system.pos-right:hover .rail-fill,
  .nox-progress-system.pos-right.is-active-dragging .rail-fill {
    width: 5px;
  }

  .nox-progress-system.pos-right .rail-bead {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 6px #a855f7, 0 0 10px rgba(168, 85, 247, 0.7);
    margin-bottom: -4px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .nox-progress-system.pos-right .rail-bead.bead-active {
    transform: scale(1.35);
  }

  .nox-progress-system.pos-right .nox-progress-pill {
    position: absolute;
    right: 30px;
    top: 50%;
    transform: translateY(-50%) translateX(4px);
  }

  /* --------------------------------------------------------------------------
     DISCREET FLOATING PILL (TEMPORARY INTERACTION ONLY)
     -------------------------------------------------------------------------- */
  .nox-progress-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    background: rgba(13, 10, 22, 0.95);
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 9999px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s ease, transform 0.22s ease;
    white-space: nowrap;
  }

  .nox-progress-pill.pill-visible {
    opacity: 1;
  }

  .pill-value {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #f1f5f9;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    .nox-progress-system.pos-bottom {
      width: min(calc(100vw - 28px), 500px);
      bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
    }

    .nox-progress-system.pos-left {
      left: calc(env(safe-area-inset-left, 0px) + 3px);
      width: 28px;
    }

    .nox-progress-system.pos-right {
      right: calc(env(safe-area-inset-right, 0px) + 3px);
      width: 28px;
    }
  }
</style>
