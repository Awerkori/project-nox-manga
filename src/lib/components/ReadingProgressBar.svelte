<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ProgressPosition, ProgressDisplay, ReadingMode } from '$lib/reader-settings';

  let {
    mode = 'webtoon',
    currentPage = 1,
    totalPages = 1,
    position = 'bottom',
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
    if (typeof window === 'undefined') return;

    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
      return;
    }

    // Webtoon mode: calculate scroll percentage from entire document
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
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
      scrollPercent = pct;
    }
  }

  function handleScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      calculateProgress();
      rafId = null;
    });
  }

  $effect(() => {
    if (mode === 'paginated') {
      scrollPercent = totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
    } else {
      calculateProgress();
    }
  });

  onMount(() => {
    isMounted = true;
    calculateProgress();
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

  function handleTrackClick(e: MouseEvent) {
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
  <!-- NOX SIGNATURE READING PROGRESS BAR -->
  <aside
    class="nox-progress-system pos-{position}"
    class:ui-active={uiVisible}
    class:is-hovered={isHovered}
    role="region"
    aria-label="Progresso de leitura Project Nox"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  >
    <!-- Interactive Clickable Track Container -->
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
      <!-- Track Background Bed -->
      <div class="rail-bed"></div>

      <!-- Neon Fill Bar -->
      <div
        class="rail-fill"
        style={position === 'left' || position === 'right'
          ? `height: ${scrollPercent}%;`
          : `width: ${scrollPercent}%;`}
      >
        <!-- Radiant Progress Bead / Head -->
        <span class="rail-bead"></span>
      </div>
    </div>

    <!-- Floating Nox Pill Indicator (shows on hover or when HUD controls are active) -->
    {#if display !== 'none'}
      <div
        class="nox-progress-pill"
        class:pill-visible={uiVisible || isHovered}
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
  /* ==========================================================================
     NOX SIGNATURE READING PROGRESS BAR (RECONSTRUCTED)
     Robust across Desktop, Android, and iOS Viewports
     ========================================================================== */

  .nox-progress-system {
    position: fixed;
    z-index: 85;
    pointer-events: auto;
    transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
    -webkit-user-select: none;
  }

  /* --------------------------------------------------------------------------
     1. POSITION: BOTTOM
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-bottom {
    bottom: 0;
    left: 0;
    right: 0;
    height: 18px;
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: env(safe-area-inset-bottom, 2px);
  }

  .nox-progress-system.pos-bottom .nox-progress-rail {
    position: relative;
    width: 100%;
    height: 6px;
    background: rgba(18, 14, 28, 0.7);
    border-radius: 9999px;
    cursor: pointer;
    overflow: visible;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: height 0.2s ease;
  }

  .nox-progress-system.pos-bottom:hover .nox-progress-rail {
    height: 8px;
  }

  .nox-progress-system.pos-bottom .rail-fill {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    background: linear-gradient(90deg, #7c3aed 0%, #a855f7 60%, #c084fc 100%);
    border-radius: 9999px;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.75);
    transition: width 0.12s cubic-bezier(0.1, 0.9, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .nox-progress-system.pos-bottom .rail-bead {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 8px #c084fc, 0 0 14px rgba(168, 85, 247, 0.9);
    margin-right: -4px;
    flex-shrink: 0;
    transform: scale(0.85);
    transition: transform 0.2s ease;
  }

  .nox-progress-system.pos-bottom:hover .rail-bead {
    transform: scale(1.15);
  }

  .nox-progress-system.pos-bottom .nox-progress-pill {
    position: absolute;
    bottom: 18px;
    right: 20px;
    transform: translateY(6px);
  }

  /* --------------------------------------------------------------------------
     2. POSITION: LATERAL ESQUERDA (LEFT)
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-left {
    top: 50%;
    left: 8px;
    transform: translateY(-50%);
    width: 22px;
    height: min(65vh, 480px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: env(safe-area-inset-left, 0px);
  }

  .nox-progress-system.pos-left .nox-progress-rail {
    position: relative;
    width: 6px;
    height: 100%;
    background: rgba(18, 14, 28, 0.7);
    border-radius: 9999px;
    cursor: pointer;
    overflow: visible;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: width 0.2s ease;
  }

  .nox-progress-system.pos-left:hover .nox-progress-rail {
    width: 8px;
  }

  .nox-progress-system.pos-left .rail-fill {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, #7c3aed 0%, #a855f7 60%, #c084fc 100%);
    border-radius: 9999px;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.75);
    transition: height 0.12s cubic-bezier(0.1, 0.9, 0.2, 1);
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .nox-progress-system.pos-left .rail-bead {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 8px #c084fc, 0 0 14px rgba(168, 85, 247, 0.9);
    margin-bottom: -4px;
    flex-shrink: 0;
    transform: scale(0.85);
    transition: transform 0.2s ease;
  }

  .nox-progress-system.pos-left:hover .rail-bead {
    transform: scale(1.15);
  }

  .nox-progress-system.pos-left .nox-progress-pill {
    position: absolute;
    left: 26px;
    top: 50%;
    transform: translateY(-50%) translateX(-6px);
  }

  /* --------------------------------------------------------------------------
     3. POSITION: LATERAL DIREITA (RIGHT)
     -------------------------------------------------------------------------- */
  .nox-progress-system.pos-right {
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    width: 22px;
    height: min(65vh, 480px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding-right: env(safe-area-inset-right, 0px);
  }

  .nox-progress-system.pos-right .nox-progress-rail {
    position: relative;
    width: 6px;
    height: 100%;
    background: rgba(18, 14, 28, 0.7);
    border-radius: 9999px;
    cursor: pointer;
    overflow: visible;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: width 0.2s ease;
  }

  .nox-progress-system.pos-right:hover .nox-progress-rail {
    width: 8px;
  }

  .nox-progress-system.pos-right .rail-fill {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, #7c3aed 0%, #a855f7 60%, #c084fc 100%);
    border-radius: 9999px;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.75);
    transition: height 0.12s cubic-bezier(0.1, 0.9, 0.2, 1);
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .nox-progress-system.pos-right .rail-bead {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 0 8px #c084fc, 0 0 14px rgba(168, 85, 247, 0.9);
    margin-bottom: -4px;
    flex-shrink: 0;
    transform: scale(0.85);
    transition: transform 0.2s ease;
  }

  .nox-progress-system.pos-right:hover .rail-bead {
    transform: scale(1.15);
  }

  .nox-progress-system.pos-right .nox-progress-pill {
    position: absolute;
    right: 26px;
    top: 50%;
    transform: translateY(-50%) translateX(6px);
  }

  /* --------------------------------------------------------------------------
     FLOATING NOX PILL BADGE
     -------------------------------------------------------------------------- */
  .nox-progress-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    background: rgba(14, 11, 22, 0.88);
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 9999px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6), 0 0 8px rgba(168, 85, 247, 0.2);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
    white-space: nowrap;
  }

  .nox-progress-pill.pill-visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) translateX(0) !important;
  }

  .pill-value {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #f1f5f9;
    font-variant-numeric: tabular-nums;
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .nox-progress-system.pos-bottom {
      padding: 0 8px;
      height: 14px;
    }

    .nox-progress-system.pos-bottom .nox-progress-rail {
      height: 4px;
    }

    .nox-progress-system.pos-bottom .rail-bead {
      width: 10px;
      height: 10px;
    }

    .nox-progress-system.pos-left,
    .nox-progress-system.pos-right {
      width: 16px;
      height: min(55vh, 360px);
    }

    .nox-progress-system.pos-left .nox-progress-rail,
    .nox-progress-system.pos-right .nox-progress-rail {
      width: 4px;
    }

    .nox-progress-system.pos-left .rail-bead,
    .nox-progress-system.pos-right .rail-bead {
      width: 10px;
      height: 10px;
    }

    .pill-value {
      font-size: 10px;
    }
  }
</style>
