<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ProgressPosition, ProgressDisplay, ReadingMode } from '$lib/reader-settings';

  let {
    mode = 'webtoon',
    currentPage = 1,
    totalPages = 1,
    position = 'bottom',
    display = 'percent',
    visible = true,
    uiVisible = true,
    onPageJump = () => {}
  }: {
    mode?: ReadingMode;
    currentPage?: number;
    totalPages?: number;
    position?: ProgressPosition;
    display?: ProgressDisplay;
    visible?: boolean;
    uiVisible?: boolean;
    onPageJump?: (page: number) => void;
  } = $props();

  let scrollPercent = $state(0);
  let isMounted = false;
  let rafId: number | null = null;

  function updateScrollProgress() {
    if (typeof window === 'undefined') return;

    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      return;
    }

    // Webtoon vertical scroll progress
    const stack = document.querySelector('.page-stack') as HTMLElement | null;
    const endEl = document.getElementById('chapter-end');

    if (!stack) {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      scrollPercent = docHeight > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / docHeight) * 100))) : 0;
      return;
    }

    const stackRect = stack.getBoundingClientRect();
    const stackTop = stack.offsetTop;
    const stackHeight = stack.offsetHeight;
    const currentScroll = window.scrollY;

    // Effective scrollable distance inside the page stack
    const scrollableRange = stackHeight - window.innerHeight * 0.7;
    if (scrollableRange <= 0) {
      scrollPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      return;
    }

    const relativeScroll = currentScroll - stackTop;
    const pct = Math.min(100, Math.max(0, Math.round((relativeScroll / scrollableRange) * 100)));
    scrollPercent = pct;
  }

  function handleScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      updateScrollProgress();
      rafId = null;
    });
  }

  $effect(() => {
    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
    } else {
      updateScrollProgress();
    }
  });

  onMount(() => {
    isMounted = true;
    updateScrollProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    }
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

{#if visible}
  <aside
    class="mihon-progress-container"
    class:pos-top={position === 'top'}
    class:pos-bottom={position === 'bottom'}
    class:controls-active={uiVisible}
    aria-label="Progresso de leitura"
  >
    <!-- Progress Line -->
    <div class="progress-track" role="progressbar" aria-valuenow={scrollPercent} aria-valuemin="0" aria-valuemax="100">
      <div
        class="progress-fill"
        style="width: {scrollPercent}%;"
      ></div>
    </div>

    <!-- Floating Pill Badge (visible when controls are active or on hover) -->
    <div class="progress-pill-badge" class:badge-dimmed={!uiVisible}>
      {#if display === 'percent'}
        <span class="badge-text">{scrollPercent}%</span>
      {:else if display === 'pages'}
        <span class="badge-text">{currentPage} / {totalPages}</span>
      {:else}
        <span class="badge-text">{currentPage}/{totalPages} · {scrollPercent}%</span>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .mihon-progress-container {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 90;
    pointer-events: none;
    transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .mihon-progress-container.pos-top {
    top: 0;
  }

  .mihon-progress-container.pos-bottom {
    bottom: 0;
  }

  .progress-track {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
    transition: width 0.15s ease-out;
  }

  .progress-pill-badge {
    position: absolute;
    right: 16px;
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    background: rgba(11, 13, 23, 0.85);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 999px;
    color: #e9d5ff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    pointer-events: auto;
    transition: opacity 0.3s ease, transform 0.3s ease;
    user-select: none;
  }

  .pos-bottom .progress-pill-badge {
    bottom: 12px;
  }

  .pos-top .progress-pill-badge {
    top: 10px;
  }

  .badge-dimmed {
    opacity: 0.35;
  }

  .progress-pill-badge:hover {
    opacity: 1 !important;
    transform: scale(1.05);
    border-color: rgba(192, 132, 252, 0.6);
  }

  @media (max-width: 640px) {
    .progress-pill-badge {
      right: 12px;
      font-size: 10px;
      padding: 2px 7px;
    }
    .pos-bottom .progress-pill-badge {
      bottom: 8px;
    }
  }
</style>
