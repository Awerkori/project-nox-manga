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
  let isMounted = false;
  let rafId: number | null = null;
  let isHovered = $state(false);

  function calculateProgress() {
    if (typeof window === 'undefined' || position === 'off') return;

    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
      return;
    }

    const doc = document.documentElement;
    const body = document.body;
    const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
    const scrollHeight = Math.max(
      doc.scrollHeight,
      body.scrollHeight,
      doc.offsetHeight,
      body.offsetHeight
    );
    const clientHeight = window.innerHeight || doc.clientHeight;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) {
      scrollPercent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
    } else {
      scrollPercent = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
    }
  }

  function handleScroll() {
    if (rafId || position === 'off') return;
    rafId = requestAnimationFrame(() => {
      calculateProgress();
      rafId = null;
    });
  }

  $effect(() => {
    if (position === 'off') return;
    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
    } else {
      calculateProgress();
    }
  });

  onMount(() => {
    isMounted = true;
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
  });

  function handleTrackClick(e: MouseEvent) {
    if (position === 'off') return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    let ratio = 0;

    if (position === 'left' || position === 'right') {
      ratio = (e.clientY - rect.top) / rect.height;
    } else {
      ratio = (e.clientX - rect.left) / rect.width;
    }

    ratio = Math.max(0, Math.min(1, ratio));

    if (mode === 'paginated') {
      const targetPage = Math.max(1, Math.min(totalPages, Math.round(ratio * totalPages)));
      onPageJump(targetPage);
    } else {
      const doc = document.documentElement;
      const scrollHeight = doc.scrollHeight - window.innerHeight;
      window.scrollTo({
        top: scrollHeight * ratio,
        behavior: 'smooth'
      });
    }
  }
</script>

{#if position !== 'off'}
  <!-- NOX ULTRA-FINE PROGRESS BAR (DISCREET & ELEGANT) -->
  <aside
    class="nox-progress-system pos-{position}"
    class:ui-active={uiVisible}
    class:is-hovered={isHovered}
    role="region"
    aria-label="Progresso de leitura"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  >
    <!-- Interactive Track -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="nox-progress-rail"
      role="progressbar"
      tabindex="0"
      aria-valuenow={scrollPercent}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Barra de rolagem de leitura"
      onclick={handleTrackClick}
    >
      <!-- Track Bed -->
      <div class="rail-bed"></div>

      <!-- Fine Neon Fill -->
      <div
        class="rail-fill"
        style={position === 'left' || position === 'right'
          ? `height: ${scrollPercent}%;`
          : `width: ${scrollPercent}%;`}
      >
        <span class="rail-bead"></span>
      </div>
    </div>

    <!-- Discreet Pill (Shown on hover or when HUD is open) -->
    {#if display !== 'none'}
      <div
        class="nox-progress-pill"
        class:pill-visible={isHovered || uiVisible}
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
  }

  /* --------------------------------------------------------------------------
     1. POSITION: BOTTOM
     Floats comfortably ABOVE Android system gesture / URL bars
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-bottom {
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
    width: min(calc(100vw - 36px), 840px);
    height: 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .nox-progress-system.pos-bottom .nox-progress-rail {
    position: relative;
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    cursor: pointer;
    overflow: visible;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: height 0.15s ease, background-color 0.15s ease;
  }

  .nox-progress-system.pos-bottom:hover .nox-progress-rail {
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
  }

  .nox-progress-system.pos-bottom .rail-fill {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background: linear-gradient(90deg, #9333ea 0%, #a855f7 60%, #c084fc 100%);
    border-radius: 9999px;
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
    transition: width 0.1s linear;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .nox-progress-system.pos-bottom .rail-bead {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 4px #c084fc, 0 0 8px rgba(168, 85, 247, 0.8);
    margin-right: -2px;
    flex-shrink: 0;
  }

  .nox-progress-system.pos-bottom .nox-progress-pill {
    position: absolute;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%) translateY(4px);
  }

  /* --------------------------------------------------------------------------
     2. POSITION: LEFT
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-left {
    top: 50%;
    left: calc(env(safe-area-inset-left, 0px) + 8px);
    transform: translateY(-50%);
    width: 16px;
    height: min(45vh, 280px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nox-progress-system.pos-left .nox-progress-rail {
    position: relative;
    width: 3px;
    height: 100%;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    cursor: pointer;
    overflow: visible;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: width 0.15s ease;
  }

  .nox-progress-system.pos-left:hover .nox-progress-rail {
    width: 4px;
    background: rgba(255, 255, 255, 0.15);
  }

  .nox-progress-system.pos-left .rail-fill {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, #9333ea 0%, #a855f7 60%, #c084fc 100%);
    border-radius: 9999px;
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
    transition: height 0.1s linear;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .nox-progress-system.pos-left .rail-bead {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 4px #c084fc, 0 0 8px rgba(168, 85, 247, 0.8);
    margin-bottom: -2px;
    flex-shrink: 0;
  }

  .nox-progress-system.pos-left .nox-progress-pill {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%) translateX(-4px);
  }

  /* --------------------------------------------------------------------------
     3. POSITION: RIGHT
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-right {
    top: 50%;
    right: calc(env(safe-area-inset-right, 0px) + 8px);
    transform: translateY(-50%);
    width: 16px;
    height: min(45vh, 280px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nox-progress-system.pos-right .nox-progress-rail {
    position: relative;
    width: 3px;
    height: 100%;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    cursor: pointer;
    overflow: visible;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: width 0.15s ease;
  }

  .nox-progress-system.pos-right:hover .nox-progress-rail {
    width: 4px;
    background: rgba(255, 255, 255, 0.15);
  }

  .nox-progress-system.pos-right .rail-fill {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, #9333ea 0%, #a855f7 60%, #c084fc 100%);
    border-radius: 9999px;
    box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
    transition: height 0.1s linear;
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .nox-progress-system.pos-right .rail-bead {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 4px #c084fc, 0 0 8px rgba(168, 85, 247, 0.8);
    margin-bottom: -2px;
    flex-shrink: 0;
  }

  .nox-progress-system.pos-right .nox-progress-pill {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%) translateX(4px);
  }

  /* --------------------------------------------------------------------------
     DISCREET PILL BADGE
     -------------------------------------------------------------------------- */
  .nox-progress-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    background: rgba(12, 10, 20, 0.92);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 9999px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    white-space: nowrap;
  }

  .nox-progress-pill.pill-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .pill-value {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: #e2e8f0;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    .nox-progress-system.pos-bottom {
      width: min(calc(100vw - 28px), 500px);
      bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
    }
  }
</style>
